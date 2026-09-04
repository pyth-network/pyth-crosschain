/**
 * Review checks for a governance proposal, separated from the CLI that prints them.
 *
 * A proposal is a flat list of actions, but governance actions are chain-scoped: only the order
 * within one target chain matters. These helpers regroup a proposal into that shape and check the
 * orderings the Pyth Pro cutover depends on.
 */

import type {
  DataSource,
  PythGovernanceAction,
} from "@pythnetwork/xc-admin-common";
import {
  AuthorizeGovernanceDataSourceTransfer,
  RequestGovernanceDataSourceTransfer,
  SetDataSources,
} from "@pythnetwork/xc-admin-common";

import type { DeploymentType } from "../src/core/base";
import { getDefaultDeploymentConfig } from "../src/core/base";
import { sameDataSourceSet } from "./pro_cutover";

/** Something a reviewer needs to know before approving. */
export type Finding = {
  message: string;
  severity: "CRITICAL" | "WARNING";
};

/** One governance action and where it sits in the proposal, which is its VAA sequence order. */
export type ProposedAction = {
  action: PythGovernanceAction;
  index: number;
};

const DEPLOYMENT_TYPES: DeploymentType[] = [
  "stable",
  "beta",
  "pro-compatible-staging",
  "pro-compatible-production",
];

/**
 * Reads an action's name.
 *
 * `PythGovernanceActionImpl` subclasses expose it as `action` while classes implementing
 * `PythGovernanceAction` directly (`SetDataSources`) expose it as `actionName`, and the shared type
 * declares neither. Accept both rather than assuming.
 * @param {PythGovernanceAction} action The action to name.
 * @returns The action name, or a placeholder if it carries neither field.
 */
export function actionNameOf(action: PythGovernanceAction): string {
  const named = action as { action?: string; actionName?: string };
  return named.action ?? named.actionName ?? "UnknownAction";
}

/**
 * Works out which deployment the given data sources belong to.
 * @param {DataSource[]} dataSources The data sources named by a `SetDataSources` action.
 * @returns The matching deployment type, or undefined if they match none of them.
 */
export function identifyDataSources(
  dataSources: DataSource[],
): DeploymentType | undefined {
  return DEPLOYMENT_TYPES.find((type) =>
    sameDataSourceSet(
      getDefaultDeploymentConfig(type).dataSources,
      dataSources,
    ),
  );
}

/**
 * Regroups a proposal's actions by the chain they target, preserving proposal order within a chain.
 * @param {ProposedAction[]} actions The proposal's actions, in proposal order.
 * @returns The actions keyed by target chain name.
 */
export function groupByTargetChain(
  actions: ProposedAction[],
): Map<string, ProposedAction[]> {
  const byChain = new Map<string, ProposedAction[]>();
  for (const entry of actions) {
    const existing = byChain.get(entry.action.targetChainId) ?? [];
    existing.push(entry);
    byChain.set(entry.action.targetChainId, existing);
  }
  return byChain;
}

/**
 * Checks the actions targeting one chain for the ordering the cutover depends on.
 *
 * Only chains whose actions look like a cutover are checked, so ordinary single-action proposals
 * produce nothing.
 * @param {string} chainName The wormhole chain name these actions target.
 * @param {ProposedAction[]} entries The chain's actions, in proposal order.
 * @returns Any findings for this chain.
 */
function checkCutoverShape(
  chainName: string,
  entries: ProposedAction[],
): Finding[] {
  const findings: Finding[] = [];
  const positionOf = (name: string): number =>
    entries.findIndex((entry) => actionNameOf(entry.action) === name);
  const label = (position: number): string =>
    `#${(entries[position]?.index ?? 0) + 1}`;

  const upgrade = positionOf("UpgradeContract");
  const setSources = positionOf("SetDataSources");
  const setWormhole = positionOf("SetWormholeAddress");

  // Nothing cutover-shaped here, so there is no ordering to enforce.
  if (setSources === -1 && setWormhole === -1) return findings;

  if (setSources !== -1 && setWormhole === -1) {
    findings.push({
      message:
        `${chainName}: SetDataSources (${label(setSources)}) with no SetWormholeAddress after it. The proxy ` +
        `would hold Pro data sources while still verifying against its old wormhole, so it could verify ` +
        `no price update at all.`,
      severity: "CRITICAL",
    });
  }
  if (setSources !== -1 && setWormhole !== -1 && setWormhole < setSources) {
    findings.push({
      message:
        `${chainName}: SetWormholeAddress (${label(setWormhole)}) comes before SetDataSources ` +
        `(${label(setSources)}). The proxy would verify legacy data sources against the Pro receiver.`,
      severity: "CRITICAL",
    });
  }
  if (setWormhole !== -1 && setSources === -1) {
    findings.push({
      message:
        `${chainName}: SetWormholeAddress (${label(setWormhole)}) with no SetDataSources. Confirm this is a ` +
        `standalone wormhole change and not half a cutover.`,
      severity: "WARNING",
    });
  }
  if (upgrade !== -1 && setSources !== -1 && upgrade > setSources) {
    findings.push({
      message:
        `${chainName}: UpgradeContract (${label(upgrade)}) comes after SetDataSources (${label(setSources)}). ` +
        `The implementation has to be in place before the data sources change.`,
      severity: "CRITICAL",
    });
  }
  return findings;
}

/**
 * Reviews a whole proposal.
 *
 * Checks that apply to any proposal:
 * - a governance data source transfer, which hands the contract to a different emitter
 * - `SetDataSources` naming emitters that match no deployment config in this repo
 *
 * Plus the per-chain cutover ordering, which only applies to chains whose actions look like one.
 * @param {ProposedAction[]} actions The proposal's actions, in proposal order.
 * @param {object} options Review options.
 * @param {boolean} options.allowGovernanceTransfer Downgrade a governance transfer to a warning,
 * for a proposal that is deliberately handing governance to a new emitter.
 * @returns Everything a reviewer needs to see, most severe first.
 */
export function reviewProposedActions(
  actions: ProposedAction[],
  options: { allowGovernanceTransfer: boolean },
): Finding[] {
  const findings: Finding[] = [];

  for (const entry of actions) {
    if (
      entry.action instanceof AuthorizeGovernanceDataSourceTransfer ||
      entry.action instanceof RequestGovernanceDataSourceTransfer
    ) {
      findings.push({
        message:
          `#${entry.index + 1} ${actionNameOf(entry.action)} on ${entry.action.targetChainId} hands governance ` +
          `to a different emitter. Nothing in a Pro cutover needs this, and after it lands the current ` +
          `vault can no longer govern that contract.`,
        severity: options.allowGovernanceTransfer ? "WARNING" : "CRITICAL",
      });
    }
    if (
      entry.action instanceof SetDataSources &&
      identifyDataSources(entry.action.dataSources) === undefined
    ) {
      findings.push({
        message:
          `#${entry.index + 1} SetDataSources on ${entry.action.targetChainId} names data sources that match ` +
          `no deployment config in this repo. Price updates would have to come from an emitter nobody ` +
          `here knows about.`,
        severity: "CRITICAL",
      });
    }
  }

  for (const [chainName, entries] of groupByTargetChain(actions)) {
    findings.push(...checkCutoverShape(chainName, entries));
  }

  const rank = (finding: Finding): number =>
    finding.severity === "CRITICAL" ? 0 : 1;
  return findings.sort((a, b) => rank(a) - rank(b));
}

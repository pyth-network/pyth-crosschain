/* eslint-disable no-console */
import { Connection, PublicKey } from "@solana/web3.js";
import {
  BPF_UPGRADABLE_LOADER,
  decodeProgramAccount,
  decodeProgramDataAccount,
} from "@pythnetwork/xc-admin-common";
import * as fs from "fs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { PYTHNET_PROGRAMS } from "../src/core/pythnet-programs";
import type { PythnetProgram } from "../src/core/pythnet-programs";

interface ProgramAuthorityEntry {
  name: string;
  program_id: string;
  source: string;
  upgrade_authority: string | null;
  programdata_address: string | null;
  last_deploy_slot: number | null;
  notes: string;
  state_authorities: never[];
}

interface AuthorityReport {
  rpc: string;
  generated_at: string;
  programs: ProgramAuthorityEntry[];
  validators: never[];
}

const parser = yargs(hideBin(process.argv))
  .usage("Usage: $0")
  .options({
    rpc: {
      default: "https://pythnet.rpcpool.com",
      desc: "Pythnet RPC endpoint URL",
      type: "string",
    },
    out: {
      default: "pythnet-authorities.json",
      desc: "Output JSON file path",
      type: "string",
    },
    programs: {
      desc: "Optional path to a JSON file with custom program list",
      type: "string",
    },
  });

async function fetchUpgradeAuthority(
  connection: Connection,
  program: PythnetProgram,
): Promise<ProgramAuthorityEntry> {
  const entry: ProgramAuthorityEntry = {
    name: program.name,
    program_id: program.programId.toBase58(),
    source: program.source,
    upgrade_authority: null,
    programdata_address: null,
    last_deploy_slot: null,
    notes: "",
    state_authorities: [],
  };

  if (program.isValidatorBuiltin) {
    entry.notes = "validator builtin — upgraded via validator release";
    return entry;
  }

  // Fetch the program account to get the programdata address
  const programAccountInfo = await connection.getAccountInfo(program.programId);
  if (!programAccountInfo) {
    entry.notes = "program account not found";
    return entry;
  }

  if (!programAccountInfo.owner.equals(BPF_UPGRADABLE_LOADER)) {
    entry.notes = `unexpected owner: ${programAccountInfo.owner.toBase58()}`;
    return entry;
  }

  const programdataAddress = decodeProgramAccount(
    programAccountInfo.data as Buffer,
  );
  entry.programdata_address = programdataAddress.toBase58();

  // Fetch the ProgramData account to get upgrade authority
  const programdataAccountInfo =
    await connection.getAccountInfo(programdataAddress);
  if (!programdataAccountInfo) {
    entry.notes = "programdata account not found";
    return entry;
  }

  const programData = decodeProgramDataAccount(
    programdataAccountInfo.data as Buffer,
  );
  entry.last_deploy_slot = programData.slot;
  entry.upgrade_authority = programData.upgradeAuthority
    ? programData.upgradeAuthority.toBase58()
    : null;

  if (!programData.upgradeAuthority) {
    entry.notes = "program is immutable (no upgrade authority)";
  }

  return entry;
}

async function loadCustomPrograms(path: string): Promise<PythnetProgram[]> {
  const content = fs.readFileSync(path, "utf-8");
  const data = JSON.parse(content) as Array<{
    name: string;
    program_id: string;
    source: string;
    is_validator_builtin?: boolean;
  }>;
  return data.map((p) => ({
    name: p.name,
    programId: new PublicKey(p.program_id),
    source: p.source,
    isValidatorBuiltin: p.is_validator_builtin ?? false,
  }));
}

async function main() {
  const argv = await parser.argv;
  const rpcUrl = argv.rpc;
  const connection = new Connection(rpcUrl, "confirmed");

  const programs = argv.programs
    ? await loadCustomPrograms(argv.programs)
    : PYTHNET_PROGRAMS;

  console.log(`Connecting to ${rpcUrl}...`);
  console.log(`Querying ${programs.length} programs...\n`);

  const entries: ProgramAuthorityEntry[] = [];

  for (const program of programs) {
    try {
      const entry = await fetchUpgradeAuthority(connection, program);
      entries.push(entry);
      console.log(`✓ ${program.name}: authority=${entry.upgrade_authority ?? "null"}`);
    } catch (error) {
      console.error(`✗ ${program.name}: ${error}`);
      entries.push({
        name: program.name,
        program_id: program.programId.toBase58(),
        source: program.source,
        upgrade_authority: null,
        programdata_address: null,
        last_deploy_slot: null,
        notes: `error: ${error instanceof Error ? error.message : String(error)}`,
        state_authorities: [],
      });
    }
  }

  const report: AuthorityReport = {
    rpc: rpcUrl,
    generated_at: new Date().toISOString(),
    programs: entries,
    validators: [],
  };

  // Write JSON output
  fs.writeFileSync(argv.out, JSON.stringify(report, null, 2) + "\n");
  console.log(`\nJSON output written to ${argv.out}`);

  // Print human-readable table
  console.log("\n--- Pythnet BPF Upgrade Authorities ---\n");
  console.table(
    entries.map((e) => ({
      Program: e.name,
      "Program ID": e.program_id,
      "Upgrade Authority": e.upgrade_authority ?? "(none)",
      "Last Deploy Slot": e.last_deploy_slot ?? "-",
      Notes: e.notes || "-",
    })),
  );

  // Exit non-zero if all programs had errors
  const allFailed = entries.every((e) => e.notes.startsWith("error:"));
  if (allFailed) {
    console.error("\nAll program queries failed. Check the RPC endpoint.");
    process.exit(1);
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();

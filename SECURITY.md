# Security

## Bug Bounty Program

Pyth operates a self hosted [bug bounty program](https://pyth.network/bounty) to financially incentivize independent researchers (with up to $500,000 USDC) for finding and responsibly disclosing security issues.

- **Scopes**
  - [Pyth Oracle](https://github.com/pyth-network/pyth-client/tree/main/program)
  - [Pyth Crosschain Ethereum](/target_chains/ethereum/contracts/contracts/pyth)
  - [Pyth Crosschain Aptos](/target_chains/aptos/contracts)
  - [Pyth Crosschain Sui](/target_chains/sui/contracts)
  - [Pyth Governance](https://github.com/pyth-network/governance/tree/master/staking/programs/staking)
- **Rewards**
  - Critical: Up to $500,000
  - High: Up to $100,000

If you find a security issue in Pyth, please [report the issue](https://yyyf63zqhtu.typeform.com/to/dBV4qcP0) immediately to our security team.

If there is a duplicate report, either the same reporter or different reporters, the first of the two by timestamp will be accepted as the official bug report and will be subject to the specific terms of the submitting program.

## 3rd Party Security Audits

We engage 3rd party firms to conduct independent security audits of Pyth. At any given time, we likely have multiple audit streams in progress.

As these 3rd party audits are completed and issues are sufficiently addressed, we make those audit reports public.

- **[April 27, 2022 - Zellic](https://github.com/pyth-network/audit-reports/blob/main/2022_04_27/pyth2wormhole_zellic.pdf)**
  - **Scope**: _pyth-crosschain (formerly known as pyth2wormhole))_
- **[October 10, 2022 - OtterSec](https://github.com/pyth-network/audit-reports/blob/main/2022_10_10/pyth_aptos.pdf)**
  - **Scope**: _pyth-crosschain-aptos contracts_
- **[November 01, 2022 - Zellic](https://github.com/pyth-network/audit-reports/blob/main/2022_11_01/pyth.pdf)**
  - **Scope**: _pyth-crosschain-evm contracts_
- **[December 12, 2022 - Ottersec](https://github.com/pyth-network/audit-reports/blob/main/2023_07_27/pyth_sui_audit_final.pdf)**
  - **Scope**: _pyth-crosschain-sui contracts_
- **[December 13, 2022 - CertiK](https://github.com/pyth-network/audit-reports/blob/pyth-certik/2022_12_13/pyth-crosschain-governance.pdf)**
  - **Scope**: _pyth-crosschain-governance contracts_
- **[December 13, 2022 - CertiK](https://github.com/pyth-network/audit-reports/blob/pyth-certik/2022_12_13/pyth-crosschain-solana.pdf)**
  - **Scope**: _pyth-crosschain-solana contracts_
- **[February 23, 2023 - CertiK](https://github.com/pyth-network/audit-reports/blob/pyth-certik/2023_02_23/pyth-crosschain-eth.pdf)**
  - **Scope**: _pyth-crosschain-evm contracts_
- **[March 14, 2023 - Zellic](https://github.com/pyth-network/audit-reports/blob/main/2023_03_14/Pyth%20Network%20-%20Zellic%20Audit%20Report.pdf)**
  - **Scope**: _pyth-crosschain-cosmwasm contracts_
- **[July 10, 2023 - Zellic](https://github.com/pyth-network/audit-reports/blob/main/2023_07_26/EVM%20Patch%20Review.pdf)**
  - **Scope**: _pyth-crosschain-evm contracts_
- **[July 24, 2023 - Zellic](https://github.com/pyth-network/audit-reports/blob/main/2023_07_26/Pyth%20Network%20Smart%20Contract%20Patch%20Review.pdf)**
  - **Scope**: _pyth-crosschain-cosmwasm/aptos/sui contracts_
- **[July 31, 2023 - Trail of Bits](https://github.com/pyth-network/audit-reports/blob/main/2023_07_31/Trail%20of%20Bits%20Pythnet%20Report.pdf)**
  - **Scope**: _pyth-crosschain pythnet validator, message_buffer/remote_executor/oracle contracts, merkle tree library, xc_admin_frontend_
- **[January 18, 2024 - Trail of Bits](https://github.com/pyth-network/audit-reports/blob/main/2024_01_23/Pyth%20Data%20Association%20-%20Entropy%20-%20Comprehensive%20Report.pdf)**
  - **Scope**: _pyth-crosschain-entropy contracts and fortuna web service_
- **[April 25, 2024 - Ottersec](https://github.com/pyth-network/audit-reports/blob/main/2024_04_25/pyth_solana_pull_oracle_audit_final.pdf)**
  - **Scope**: _pyth-crosschain-solana contracts_
- **[July 12, 2024 - Nethermind](https://github.com/pyth-network/audit-reports/blob/main/2024_07_12/pyth_starknet_pull_oracle_audit_final.pdf)**
  - **Scope**: _pyth-crosschain-starknet contracts_
- **[Jan 17, 2025 - Zellic](https://github.com/pyth-network/audit-reports/blob/main/2025_01_17/pyth_lazer_solana_audit_final.pdf)**
  - **Scope**: _pyth-lazer solana contract_
- **[Feb 12, 2025 - Zellic](https://github.com/pyth-network/audit-reports/blob/main/2025_02_12/pyth_lazer_evm_audit_final.pdf)**
  - **Scope**: _pyth-lazer evm contract_

## Social Media Monitoring

The Pyth project maintains a social media monitoring program to stay abreast of important ecosystem developments.

These developments include monitoring services like Twitter for key phrases and patterns such that the Pyth project is informed of a compromise or vulnerability in a dependency that could negatively affect Pyth or its users.

In the case of a large ecosystem development that requires response, the Pyth project will engage its security incident response program.

## Incident Response

The Pyth project maintains an incident response program to respond to vulnerabilities or active threats to Pyth, its users, or the ecosystems it's connected to. Pyth can be made aware about a security event from a variety of different sources (eg. bug bounty program, audit finding, security monitoring, social media, etc.)

When a Pyth project contributor becomes aware of a security event, that contributor immediately holds the role of [incident commander](https://en.wikipedia.org/wiki/Incident_commander) for the issue until they hand off to a more appropriate incident commander. A contributor does not need to be a "security person" or have any special privileges to hold the role of incident commander, they simply need to be responsible, communicate effectively, and maintain the following obligations to manage the incident to completion.

The role of the incident commander for Pyth includes the following minimum obligations:

- Understand what is going on, the severity, and advance the state of the incident.
- Identify and contact the relevant responders needed to address the issue.
- Identify what actions are needed for containment (eg. security patch, contracts deployed, governance ceremony).
- Establish a dedicated real-time communication channel for responders to coordinate (eg. Slack, Telegram, Signal, or Zoom).
- Establish a private incident document, where the problem, timeline, actions, artifacts, lessons learned, etc. can be tracked and shared with responders.
- When an incident is over, host a [retrospective](https://en.wikipedia.org/wiki/Retrospective) with key responders to understand how things could be handled better in the future (this is a no blame session, the goal is objectively about improving Pyth's readiness and response capability in the future).
- Create issues in relevant ticket trackers for actions based on lessons learned.

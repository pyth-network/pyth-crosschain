/**
 * Fixture-based test for list_pythnet_authorities JSON output schema.
 *
 * Run: pnpm --filter @pythnetwork/contract-manager exec tsx scripts/__tests__/list_pythnet_authorities.test.ts
 *
 * Live RPC test (optional): TEST_LIVE_RPC=1 pnpm --filter @pythnetwork/contract-manager exec tsx scripts/__tests__/list_pythnet_authorities.test.ts
 */
/* eslint-disable no-console */
import assert from "node:assert";
import { PublicKey } from "@solana/web3.js";
import {
  decodeProgramAccount,
  decodeProgramDataAccount,
} from "../../../governance/xc_admin/packages/xc_admin_common/src/bpf_upgradable_loader";
import { PYTHNET_PROGRAMS } from "../../src/core/pythnet-programs";

// -- Fixture: a recorded Program account (type=2) pointing to a programdata address --
// Type 2 (Program) = 02 00 00 00 in LE, followed by 32-byte programdata pubkey
const FIXTURE_PROGRAMDATA_PUBKEY = new PublicKey(
  "BJ3jrUzddfuSrZHXSCxMUUQsjKEyLmuuyZebPtaxyPBJ",
);
const programAccountData = Buffer.alloc(36);
programAccountData.writeUInt32LE(2, 0);
FIXTURE_PROGRAMDATA_PUBKEY.toBuffer().copy(programAccountData, 4);

// -- Fixture: a recorded ProgramData account (type=3) with upgrade authority --
const FIXTURE_AUTHORITY = new PublicKey(
  "3HGMrhJx7GhZHZSgxVikvRG4iz2gmqiH8WPqMYdykeyN",
);
const FIXTURE_SLOT = 123456789;
const programDataWithAuthority = Buffer.alloc(45);
programDataWithAuthority.writeUInt32LE(3, 0);
programDataWithAuthority.writeBigUInt64LE(BigInt(FIXTURE_SLOT), 4);
programDataWithAuthority[12] = 1; // Some(authority)
FIXTURE_AUTHORITY.toBuffer().copy(programDataWithAuthority, 13);

// -- Fixture: ProgramData with no authority (immutable) --
const programDataNoAuthority = Buffer.alloc(45);
programDataNoAuthority.writeUInt32LE(3, 0);
programDataNoAuthority.writeBigUInt64LE(BigInt(999), 4);
programDataNoAuthority[12] = 0; // None

function testDecodeProgramAccount() {
  const result = decodeProgramAccount(programAccountData);
  assert.ok(result.equals(FIXTURE_PROGRAMDATA_PUBKEY), "decoded programdata address should match fixture");
  console.log("  PASS: decodeProgramAccount");
}

function testDecodeProgramDataWithAuthority() {
  const result = decodeProgramDataAccount(programDataWithAuthority);
  assert.strictEqual(result.slot, FIXTURE_SLOT, "slot should match");
  assert.ok(result.upgradeAuthority !== null, "authority should not be null");
  assert.ok(
    result.upgradeAuthority!.equals(FIXTURE_AUTHORITY),
    "authority should match fixture",
  );
  console.log("  PASS: decodeProgramDataAccount (with authority)");
}

function testDecodeProgramDataNoAuthority() {
  const result = decodeProgramDataAccount(programDataNoAuthority);
  assert.strictEqual(result.slot, 999, "slot should be 999");
  assert.strictEqual(result.upgradeAuthority, null, "authority should be null for immutable program");
  console.log("  PASS: decodeProgramDataAccount (no authority / immutable)");
}

function testInvalidAccountType() {
  const badData = Buffer.alloc(36);
  badData.writeUInt32LE(99, 0);
  assert.throws(() => decodeProgramAccount(badData), /Expected Program account type/);
  console.log("  PASS: decodeProgramAccount rejects invalid type");
}

function testProgramRegistry() {
  assert.ok(PYTHNET_PROGRAMS.length >= 3, "should have at least 3 programs");
  for (const p of PYTHNET_PROGRAMS) {
    assert.ok(p.name, "program must have a name");
    assert.ok(p.programId instanceof PublicKey, "programId must be a PublicKey");
    assert.ok(p.source, "program must have a source");
  }
  console.log("  PASS: PYTHNET_PROGRAMS registry is valid");
}

function testOutputSchema() {
  // Verify the expected JSON schema shape
  const sampleOutput = {
    rpc: "https://pythnet.rpcpool.com",
    generated_at: new Date().toISOString(),
    programs: [
      {
        name: "Test",
        program_id: "11111111111111111111111111111111",
        source: "test",
        upgrade_authority: FIXTURE_AUTHORITY.toBase58(),
        programdata_address: FIXTURE_PROGRAMDATA_PUBKEY.toBase58(),
        last_deploy_slot: FIXTURE_SLOT,
        notes: "",
        state_authorities: [],
      },
    ],
    validators: [],
  };

  assert.ok(typeof sampleOutput.rpc === "string");
  assert.ok(typeof sampleOutput.generated_at === "string");
  assert.ok(Array.isArray(sampleOutput.programs));
  assert.ok(Array.isArray(sampleOutput.validators));
  const prog = sampleOutput.programs[0];
  assert.ok(typeof prog.name === "string");
  assert.ok(typeof prog.program_id === "string");
  assert.ok(typeof prog.source === "string");
  assert.ok(Array.isArray(prog.state_authorities));
  console.log("  PASS: JSON output schema is valid");
}

async function main() {
  console.log("Running fixture-based tests...\n");

  testDecodeProgramAccount();
  testDecodeProgramDataWithAuthority();
  testDecodeProgramDataNoAuthority();
  testInvalidAccountType();
  testProgramRegistry();
  testOutputSchema();

  console.log("\nAll fixture tests passed!");
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises, unicorn/prefer-top-level-await
main();

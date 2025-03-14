import { PythCluster } from "@pythnetwork/client";
import {
  MultisigInstructionProgram,
  MultisigParser,
  UNRECOGNIZED_INSTRUCTION,
} from "../multisig_transaction";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { SystemProgramMultisigInstruction } from "../multisig_transaction/SystemProgramInstruction";

test("System multisig instruction parse", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";

  const parser = MultisigParser.fromCluster(cluster);

  const transferInstruction = SystemProgram.transfer({
    fromPubkey: new PublicKey(1),
    toPubkey: new PublicKey(2),
    lamports: 100,
  });

  const parsedInstruction = parser.parseInstruction(transferInstruction);
  if (parsedInstruction instanceof SystemProgramMultisigInstruction) {
    expect(parsedInstruction.program).toBe(
      MultisigInstructionProgram.SystemProgram,
    );
    expect(parsedInstruction.name).toBe("Transfer");
    expect(
      parsedInstruction.args.fromPubkey.equals(new PublicKey(1)),
    ).toBeTruthy();
    expect(
      parsedInstruction.args.toPubkey.equals(new PublicKey(2)),
    ).toBeTruthy();
    expect(parsedInstruction.args.lamports.toString()).toBe("100");
  } else {
    done("Not instance of SystemInstruction");
  }

  const badInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey(SystemProgram.programId),
    data: Buffer.from([1, 2, 3, 4]),
  });
  const parsedBadInstruction = parser.parseInstruction(badInstruction);
  if (parsedBadInstruction instanceof SystemProgramMultisigInstruction) {
    expect(parsedBadInstruction.program).toBe(
      MultisigInstructionProgram.SystemProgram,
    );
    expect(parsedBadInstruction.name).toBe(UNRECOGNIZED_INSTRUCTION);
    expect(
      parsedBadInstruction.args.data.equals(Buffer.from([1, 2, 3, 4])),
    ).toBeTruthy();
    done();
  } else {
    done("Not instance of SystemInstruction");
  }
});

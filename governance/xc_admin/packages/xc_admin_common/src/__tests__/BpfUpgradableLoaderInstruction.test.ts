import { PythCluster } from "@pythnetwork/client";
import {
  BpfUpgradableLoaderInstruction,
  MultisigInstructionProgram,
  MultisigParser,
  UNRECOGNIZED_INSTRUCTION,
} from "../multisig_transaction";
import {
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { BPF_UPGRADABLE_LOADER } from "../bpf_upgradable_loader";

test("Bpf Upgradable Loader multisig instruction parse", (done) => {
  jest.setTimeout(60000);

  const cluster: PythCluster = "devnet";

  const parser = MultisigParser.fromCluster(cluster);

  const upgradeInstruction = new TransactionInstruction({
    programId: BPF_UPGRADABLE_LOADER,
    data: Buffer.from([3, 0, 0, 0]),
    keys: [
      { pubkey: new PublicKey(0), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(1), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(2), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(3), isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      {
        pubkey: new PublicKey(4),
        isSigner: true,
        isWritable: false,
      },
      {
        pubkey: new PublicKey(5),
        isSigner: true,
        isWritable: false,
      },
    ],
  });

  const parsedInstruction = parser.parseInstruction(upgradeInstruction);
  if (parsedInstruction instanceof BpfUpgradableLoaderInstruction) {
    expect(parsedInstruction.program).toBe(
      MultisigInstructionProgram.BpfUpgradableLoader,
    );
    expect(parsedInstruction.name).toBe("Upgrade");
    expect(
      parsedInstruction.accounts.named.programData.pubkey.equals(
        new PublicKey(0),
      ),
    ).toBeTruthy();
    expect(
      parsedInstruction.accounts.named.program.pubkey.equals(new PublicKey(1)),
    ).toBeTruthy();
    expect(
      parsedInstruction.accounts.named.buffer.pubkey.equals(new PublicKey(2)),
    ).toBeTruthy();
    expect(
      parsedInstruction.accounts.named.spill.pubkey.equals(new PublicKey(3)),
    ).toBeTruthy();
    expect(
      parsedInstruction.accounts.named.rent.pubkey.equals(SYSVAR_RENT_PUBKEY),
    ).toBeTruthy();
    expect(
      parsedInstruction.accounts.named.clock.pubkey.equals(SYSVAR_CLOCK_PUBKEY),
    ).toBeTruthy();
    expect(
      parsedInstruction.accounts.named.upgradeAuthority.pubkey.equals(
        new PublicKey(4),
      ),
    ).toBeTruthy();
    expect(parsedInstruction.accounts.remaining.length).toBe(1);
    expect(
      parsedInstruction.accounts.remaining[0].pubkey.equals(new PublicKey(5)),
    ).toBeTruthy();
    expect(parsedInstruction.args).toEqual({});
  } else {
    done("Not instance of BpfUpgradableLoaderInstruction");
  }

  const badInstruction = new TransactionInstruction({
    keys: [],
    programId: new PublicKey(BPF_UPGRADABLE_LOADER),
    data: Buffer.from([9]),
  });

  const parsedBadInstruction = parser.parseInstruction(badInstruction);
  if (parsedBadInstruction instanceof BpfUpgradableLoaderInstruction) {
    expect(parsedBadInstruction.program).toBe(
      MultisigInstructionProgram.BpfUpgradableLoader,
    );
    expect(parsedBadInstruction.name).toBe(UNRECOGNIZED_INSTRUCTION);
    expect(
      parsedBadInstruction.args.data.equals(Buffer.from([9])),
    ).toBeTruthy();
    done();
  } else {
    done("Not instance of BpfUpgradableLoaderInstruction");
  }
});

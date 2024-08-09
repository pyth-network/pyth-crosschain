// wrappers/WormholeWrapper.ts
import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
} from "@ton/core";

export class Wormhole implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromConfig(config: any, code: Cell, workchain = 0) {
    const data = beginCell().endCell();
    const init = { code, data };
    const address = contractAddress(workchain, init);
    return new Wormhole(address, init);
  }

  // NOTE: the function name has to start with "send" or "get" so that  it automatically inserts `provider` as a first argument
  async getParseEncodedUpgrade(
    provider: ContractProvider,
    currentGuardianSetIndex: number,
    encodedUpgrade: Buffer
  ) {
    const result = await provider.get("parse_encoded_upgrade", [
      { type: "int", value: BigInt(currentGuardianSetIndex) },
      { type: "cell", cell: beginCell().storeBuffer(encodedUpgrade).endCell() },
    ]);

    return {
      action: result.stack.readNumber(),
      chain: result.stack.readNumber(),
      module: result.stack.readBigNumber(),
      newGuardianSetKeys: result.stack.readCell(),
      newGuardianSetIndex: result.stack.readNumber(),
    };
  }

  static createGuardianSetUpgradeBytes(
    chainId: number,
    newGuardianSetIndex: number,
    guardians: string[]
  ): Buffer {
    const payload = Buffer.alloc(1024);
    let offset = 0;

    // Module (Core)
    payload.write("436f7265", 0, 4, "hex");
    offset += 4;

    // Action (2 for GuardianSetUpgrade)
    payload.writeUInt8(2, offset);
    offset += 1;

    // Chain ID
    payload.writeUInt16BE(chainId, offset);
    offset += 2;

    // New Guardian Set Index
    payload.writeUInt32BE(newGuardianSetIndex, offset);
    offset += 4;

    // Number of guardians
    payload.writeUInt8(guardians.length, offset);
    offset += 1;

    // Guardian addresses
    for (const guardian of guardians) {
      payload.write(guardian.slice(2), offset, 20, "hex");
      offset += 20;
    }

    return payload.subarray(0, offset);
  }

  static parseGuardianSetKeys(cell: Cell): string[] {
    const keys: string[] = [];

    function parseCell(c: Cell, depth = 0) {
      console.log(`${" ".repeat(depth)}Parsing cell at depth ${depth}`);
      let slice = c.beginParse();
      console.log(
        `${" ".repeat(depth)}Remaining bits: ${slice.remainingBits}, Remaining refs: ${slice.remainingRefs}`
      );

      while (slice.remainingRefs > 0 || slice.remainingBits >= 160) {
        if (slice.remainingBits >= 160) {
          const key = slice.loadBuffer(20);
          keys.push("0x" + key.toString("hex"));
          console.log(
            `${" ".repeat(depth)}Parsed key: 0x${key.toString("hex")}`
          );
        }
        if (slice.remainingRefs > 0) {
          console.log(`${" ".repeat(depth)}Loading ref`);
          parseCell(slice.loadRef(), depth + 1);
        }
      }
    }

    parseCell(cell);
    console.log(`Total keys parsed: ${keys.length}`);
    return keys;
  }
}

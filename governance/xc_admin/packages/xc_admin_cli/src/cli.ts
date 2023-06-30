import { program } from "commander";
import { loadContractConfig, ContractType, SyncOp } from "xc_admin_common";
import * as fs from "fs";

// TODO: extract this configuration to a file
const contractsConfig = [
  {
    type: ContractType.EvmPythUpgradable,
    networkId: "arbitrum",
    address: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  },
  {
    type: ContractType.EvmWormholeReceiver,
    networkId: "canto",
    address: "0x87047526937246727E4869C5f76A347160e08672",
  },
  {
    type: ContractType.EvmPythUpgradable,
    networkId: "canto",
    address: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  },
  {
    type: ContractType.EvmPythUpgradable,
    networkId: "avalanche",
    address: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  },
];

const networksConfig = {
  evm: {
    optimism_goerli: {
      url: `https://rpc.ankr.com/optimism_testnet`,
    },
    arbitrum: {
      url: "https://arb1.arbitrum.io/rpc",
    },
    avalanche: {
      url: "https://api.avax.network/ext/bc/C/rpc",
    },
    canto: {
      url: "https://canto.gravitychain.io",
    },
  },
};

// TODO: we will need configuration of this stuff to decide which multisig to run.
const multisigs = [
  {
    name: "",
    wormholeNetwork: "mainnet",
  },
];

program
  .name("pyth_governance")
  .description("CLI for governing Pyth contracts")
  .version("0.1.0");

program
  .command("get")
  .description("Find Pyth contracts matching the given search criteria")
  .option("-n, --network <network-id>", "Find contracts on the given network")
  .option("-a, --address <address>", "Find contracts with the given address")
  .option("-t, --type <type-id>", "Find contracts of the given type")
  .action(async (options: any) => {
    const contracts = loadContractConfig(contractsConfig, networksConfig);

    console.log(JSON.stringify(options));

    const matches = [];
    for (const contract of contracts) {
      if (
        (options.network === undefined ||
          contract.networkId == options.network) &&
        (options.address === undefined ||
          contract.getAddress() == options.address) &&
        (options.type === undefined || contract.type == options.type)
      ) {
        matches.push(contract);
      }
    }

    for (const contract of matches) {
      const state = await contract.getState();
      console.log({
        networkId: contract.networkId,
        address: contract.getAddress(),
        type: contract.type,
        state: state,
      });
    }
  });

class Cache {
  private path: string;

  constructor(path: string) {
    this.path = path;
  }

  private opFilePath(op: SyncOp): string {
    return `${this.path}/${op.id()}.json`;
  }

  public readOpCache(op: SyncOp): Record<string, any> {
    const path = this.opFilePath(op);
    if (fs.existsSync(path)) {
      return JSON.parse(fs.readFileSync(path).toString("utf-8"));
    } else {
      return {};
    }
  }

  public writeOpCache(op: SyncOp, cache: Record<string, any>) {
    fs.writeFileSync(this.opFilePath(op), JSON.stringify(cache));
  }

  public deleteCache(op: SyncOp) {
    fs.rmSync(this.opFilePath(op));
  }
}

program
  .command("set")
  .description("Set a configuration parameter for one or more Pyth contracts")
  .option("-n, --network <network-id>", "Find contracts on the given network")
  .option("-a, --address <address>", "Find contracts with the given address")
  .option("-t, --type <type-id>", "Find contracts of the given type")
  .argument("<fields...>", "Fields to set on the given contracts")
  .action(async (fields, options: any, command) => {
    const contracts = loadContractConfig(contractsConfig, networksConfig);

    console.log(JSON.stringify(fields));
    console.log(JSON.stringify(options));

    const setters = fields.map((value: string) => value.split("="));

    const matches = [];
    for (const contract of contracts) {
      if (
        (options.network === undefined ||
          contract.networkId == options.network) &&
        (options.address === undefined ||
          contract.getAddress() == options.address) &&
        (options.type === undefined || contract.type == options.type)
      ) {
        matches.push(contract);
      }
    }

    const ops = [];
    for (const contract of matches) {
      const state = await contract.getState();
      // TODO: make a decent format for this
      for (const [field, value] of setters) {
        state[field] = value;
      }

      ops.push(...(await contract.sync(state)));
    }

    // TODO: extract constant
    const cacheDir = "cache";
    fs.mkdirSync(cacheDir, { recursive: true });
    const cache = new Cache(cacheDir);

    for (const op of ops) {
      const opCache = cache.readOpCache(op);
      const isDone = await op.run(opCache);
      if (isDone) {
        cache.deleteCache(op);
      } else {
        cache.writeOpCache(op, opCache);
      }
    }
  });

program.parse();

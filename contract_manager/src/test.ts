import { DefaultStore } from "./store";

async function test() {
  for (const contract of Object.values(DefaultStore.contracts)) {
    console.log("Contract", contract.getId());
    console.log(await contract.getGovernanceDataSource());
  }
}

test();

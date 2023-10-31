import Web3 from "web3";
import CoinFlipAbi from "./CoinFlipAbi.json";

const coinFlipContractAddress = "0x075A5160FF6462924B4124595F6f987187496476";
const rpc = "https://goerli.optimism.io";

async function main() {
  const web3 = new Web3(rpc);

  const coinFlipContract = new web3.eth.Contract(
    CoinFlipAbi as any,
    coinFlipContractAddress
  );

  console.log(`here`);

  const flipFee = await coinFlipContract.methods.getFlipFee().call();

  console.log(`Fetched fee: ${flipFee}`);

  // TODO: from: sender?
  const result = await coinFlipContract.methods
    .requestFlip()
    .send({ value: flipFee });

  console.log(JSON.stringify(result));
}

main();

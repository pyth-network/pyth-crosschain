require("dotenv").config({ path: ".env" });
import { utils, Wallet } from "zksync-web3";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { assert } from "chai";
import { writeFileSync } from "fs";
import { ethers } from "ethers";

function envOrErr(name: string): string {
  const res = process.env[name];
  if (res === undefined) {
    throw new Error(`${name} environment variable is not set.`);
  }
  return res;
}

export default async function (hre: HardhatRuntimeEnvironment) {
  // Initialize the wallet.
  const wallet = Wallet.fromMnemonic(envOrErr("MNEMONIC"));

  // Create deployer object and load the artifact of the contract we want to deploy.
  const deployer = new Deployer(hre, wallet);

  // Deposit some funds to L2 in order to be able to perform L2 transactions. Uncomment
  // this if the deployment account is unfunded.
  //
  // const depositAmount = ethers.utils.parseEther("0.005");
  // const depositHandle = await deployer.zkWallet.deposit({
  //   to: deployer.zkWallet.address,
  //   token: utils.ETH_ADDRESS,
  //   amount: depositAmount,
  // });
  // // Wait until the deposit is processed on zkSync
  // await depositHandle.wait();

  const pythImplArtifact = await deployer.loadArtifact("PythUpgradable");
  const pythImplContract = await deployer.deploy(pythImplArtifact);

  console.log(
    `Deployed Pyth implementation contract on ${pythImplContract.address}`,
  );
  console.log(
    "Please use this address as the candidate new implementation in the deployment script.",
  );
}

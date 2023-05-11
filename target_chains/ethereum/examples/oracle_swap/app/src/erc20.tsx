import "./App.css";
import ERC20Abi from "./abi/ERC20MockAbi.json";
import Web3 from "web3";
import { BigNumber } from "ethers";

/**
 * Allow `approvedSpender` to spend your
 * @param web3
 * @param erc20Address
 * @param sender
 * @param approvedSpender
 */
export async function approveToken(
  web3: Web3,
  erc20Address: string,
  sender: string,
  approvedSpender: string
) {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);

  await erc20.methods
    .approve(approvedSpender, BigNumber.from("2").pow(256).sub(1))
    .send({ from: sender });
}

export async function getApprovedQuantity(
  web3: Web3,
  erc20Address: string,
  sender: string,
  approvedSpender: string
): Promise<BigNumber> {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);
  let allowance = BigNumber.from(
    await erc20.methods.allowance(sender, approvedSpender).call()
  );
  return allowance as BigNumber;
}

export async function getBalance(
  web3: Web3,
  erc20Address: string,
  address: string
): Promise<BigNumber> {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);
  return BigNumber.from(await erc20.methods.balanceOf(address).call());
}

export async function mint(
  web3: Web3,
  sender: string,
  erc20Address: string,
  destinationAddress: string,
  quantity: BigNumber
) {
  const erc20 = new web3.eth.Contract(ERC20Abi as any, erc20Address);
  await erc20.methods.mint(destinationAddress, quantity).send({ from: sender });
}

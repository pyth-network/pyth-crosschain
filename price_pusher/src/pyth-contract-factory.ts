import AbstractPythAbi from "@pythnetwork/pyth-sdk-solidity/abis/AbstractPyth.json";
import HDWalletProvider from "@truffle/hdwallet-provider";
import { Contract } from "web3-eth-contract";
import { Provider } from "web3/providers";
import Web3 from "web3";
import { isWsEndpoint } from "./utils";

export class PythContractFactory {
  constructor(
    private endpoint: string,
    private mnemonic: string,
    private pythContractAddr: string
  ) {}

  /**
   * This method creates a web3 Pyth contract with payer (based on HDWalletProvider). As this
   * provider is an HDWalletProvider it does not support subscriptions even if the
   * endpoint is a websocket endpoint.
   *
   * @returns Pyth contract
   */
  createPythContractWithPayer(): Contract {
    const provider = new HDWalletProvider({
      mnemonic: {
        phrase: this.mnemonic,
      },
      providerOrUrl: this.createWeb3Provider() as Provider,
    });

    const web3 = new Web3(provider as any);

    return new web3.eth.Contract(
      AbstractPythAbi as any,
      this.pythContractAddr,
      {
        from: provider.getAddress(0),
      }
    );
  }

  /**
   * This method creates a web3 Pyth contract with the given endpoint as its provider. If
   * the endpoint is a websocket endpoint the contract will support subscriptions.
   *
   * @returns Pyth contract
   */
  createPythContract(): Contract {
    const provider = this.createWeb3Provider();
    const web3 = new Web3(provider);
    return new web3.eth.Contract(AbstractPythAbi as any, this.pythContractAddr);
  }

  hasWebsocketProvider(): boolean {
    return isWsEndpoint(this.endpoint);
  }

  private createWeb3Provider() {
    if (isWsEndpoint(this.endpoint)) {
      Web3.providers.WebsocketProvider.prototype.sendAsync =
        Web3.providers.WebsocketProvider.prototype.send;
      return new Web3.providers.WebsocketProvider(this.endpoint, {
        clientConfig: {
          keepalive: true,
          keepaliveInterval: 30000,
        },
        reconnect: {
          auto: true,
          delay: 1000,
          onTimeout: true,
        },
        timeout: 30000,
      });
    } else {
      Web3.providers.HttpProvider.prototype.sendAsync =
        Web3.providers.HttpProvider.prototype.send;
      return new Web3.providers.HttpProvider(this.endpoint, {
        keepAlive: true,
        timeout: 30000,
      });
    }
  }
}

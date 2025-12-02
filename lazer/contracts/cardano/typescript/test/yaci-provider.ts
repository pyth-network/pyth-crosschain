import { MeshWallet, YaciProvider } from "@meshsdk/core";
 
export function getYaciProvider() {
  return new YaciProvider("http://localhost:8080/api/v1");
}

export function getWalletForYaci() {
  const blockchainProvider = getYaciProvider();
 
  return new MeshWallet({
    networkId: 0,
    fetcher: blockchainProvider,
    submitter: blockchainProvider,
    key: {
      type: "mnemonic",
      words: [
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"test", 
				"sauce"
      ],
    },
  });
}

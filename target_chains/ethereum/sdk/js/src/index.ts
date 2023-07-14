export { EvmPriceServiceConnection } from "./EvmPriceServiceConnection";

export {
  DurationInMs,
  HexString,
  Price,
  PriceFeed,
  PriceServiceConnectionConfig,
  UnixTimestamp,
} from "@pythnetwork/price-service-client";

export const CONTRACT_ADDR: Record<string, string> = {
  bnb_testnet: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
  fuji: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C", // Avalanche testnet
  fantom_testnet: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  goerli: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  mumbai: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C", // Polygon testnet
  aurora_testnet: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  bnb: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
  avalanche: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  fantom: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  polygon: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  ethereum: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  optimism: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  aurora: "0xF89C7b475821EC3fDC2dC8099032c05c6c0c9AB9",
  arbitrum: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  optimism_goerli: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  celo: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  celo_alfajores: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C", // Celo testnet
  kcc: "0xE0d0e68297772Dd5a1f1D99897c581E2082dbA5B",
  kcc_testnet: "0x15D35b8985e350f783fe3d95401401E194ff1E6f",
  cronos: "0xE0d0e68297772Dd5a1f1D99897c581E2082dbA5B",
  cronos_testnet: "0xBAEA4A1A2Eaa4E9bb78f2303C213Da152933170E",
  arbitrum_goerli: "0x939C0e902FF5B3F7BA666Cc8F6aC75EE76d3f900",
  zksync_goerli: "0xC38B1dd611889Abc95d4E0a472A667c3671c08DE",
  base_goerli: "0x5955C1478F0dAD753C7E2B4dD1b4bC530C64749f",
  shimmer_testnet: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  chiado: "0xdDAf6D29b8bc81c1F0798a5e4c264ae89c16a72B", // Gnosis testnet
  gnosis: "0x2880aB155794e7179c9eE2e38200202908C17B43",
  zksync: "0xf087c864AEccFb6A2Bf1Af6A0382B0d0f6c5D834",
  evmos: "0x354bF866A4B006C9AF9d9e06d9364217A8616E12",
  evmos_testnet: "0x354bF866A4B006C9AF9d9e06d9364217A8616E12",
  neon_devnet: "0x2FF312f50689ad279ABb164dB255Eb568733BD6c",
  polygon_zkevm_testnet: "0xd54bf1758b1C932F86B178F8b1D5d1A7e2F62C2E",
  polygon_zkevm: "0xC5E56d6b40F3e3B5fbfa266bCd35C37426537c65",
  canto: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  canto_testnet: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  meter_testnet: "0x5fF5B9039FbD8256864A4460B7EA77093A65B1b5",
  meter: "0xbFe3f445653f2136b2FD1e6DdDb5676392E3AF16",
  mantle: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  mantle_testnet: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  conflux_espace: "0xe9d69CdD6Fe41e7B621B4A688C5D1a68cB5c8ADc",
  conflux_espace_testnet: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  kava_testnet: "0x98046Bd286715D3B0BC227Dd7a956b83D8978603",
  kava: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  wemix: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  wemix_testnet: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  linea_goerli: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  linea: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRACT_ADDR =
  exports.PriceFeed =
  exports.Price =
  exports.EvmPriceServiceConnection =
    void 0;
var EvmPriceServiceConnection_1 = require("./EvmPriceServiceConnection");
Object.defineProperty(exports, "EvmPriceServiceConnection", {
  enumerable: true,
  get: function () {
    return EvmPriceServiceConnection_1.EvmPriceServiceConnection;
  },
});
var pyth_common_js_1 = require("@pythnetwork/pyth-common-js");
Object.defineProperty(exports, "Price", {
  enumerable: true,
  get: function () {
    return pyth_common_js_1.Price;
  },
});
Object.defineProperty(exports, "PriceFeed", {
  enumerable: true,
  get: function () {
    return pyth_common_js_1.PriceFeed;
  },
});
exports.CONTRACT_ADDR = {
  bnb_testnet: "0xd7308b14BF4008e7C7196eC35610B1427C5702EA",
  fuji: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  fantom_testnet: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  goerli: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  mumbai: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
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
  celo_alfajores: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  kcc: "0xE0d0e68297772Dd5a1f1D99897c581E2082dbA5B",
  kcc_testnet: "0x15D35b8985e350f783fe3d95401401E194ff1E6f",
  cronos: "0xE0d0e68297772Dd5a1f1D99897c581E2082dbA5B",
  cronos_testnet: "0xBAEA4A1A2Eaa4E9bb78f2303C213Da152933170E",
  arbitrum_goerli: "0x939C0e902FF5B3F7BA666Cc8F6aC75EE76d3f900",
  zksync_goerli: "0xF532F2C1bB7b67E08f7D8B76f9fF804D0831725e",
};

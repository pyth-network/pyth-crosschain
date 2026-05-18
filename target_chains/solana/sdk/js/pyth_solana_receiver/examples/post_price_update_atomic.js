"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var web3_js_1 = require("@solana/web3.js");
var __1 = require("../");
var anchor_1 = require("@coral-xyz/anchor");
var fs_1 = require("fs");
var os_1 = require("os");
var hermes_client_1 = require("@pythnetwork/hermes-client");
var HERMES_ACCESS_TOKEN = process.env["HERMES_ACCESS_TOKEN"];
// Get price feed ids from https://pyth.network/developers/price-feed-ids#pyth-evm-stable
var SOL_PRICE_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
var keypairFile = "";
if (process.env["SOLANA_KEYPAIR"]) {
    keypairFile = process.env["SOLANA_KEYPAIR"];
}
else {
    keypairFile = "".concat(os_1.default.homedir(), "/.config/solana/id.json");
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, keypair, wallet, pythSolanaReceiver, priceUpdateData, transactionBuilder, _a, _b;
        var _this = this;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    connection = new web3_js_1.Connection("https://api.devnet.solana.com");
                    return [4 /*yield*/, loadKeypairFromFile(keypairFile)];
                case 1:
                    keypair = _c.sent();
                    console.log("Sending transactions from account: ".concat(keypair.publicKey.toBase58()));
                    wallet = new anchor_1.Wallet(keypair);
                    pythSolanaReceiver = new __1.PythSolanaReceiver({
                        connection: connection,
                        wallet: wallet,
                        wormholeProgramId: __1.LAZER_WORMHOLE_PROGRAM_ID,
                        receiverProgramId: __1.LAZER_RECEIVER_PROGRAM_ID,
                        pushOracleProgramId: __1.LAZER_PUSH_ORACLE_PROGRAM_ID,
                    });
                    return [4 /*yield*/, getPriceUpdateData()];
                case 2:
                    priceUpdateData = _c.sent();
                    console.log("Posting price update: ".concat(priceUpdateData));
                    transactionBuilder = pythSolanaReceiver.newTransactionBuilder({
                        closeUpdateAccounts: false,
                    });
                    // Post the price updates to ephemeral accounts, one per price feed.
                    // Using this method we can post the price update in a single transaction.
                    // With 5 signatures, the transaction size is 1197 bytes
                    // With 3 signatures, the transaction size is 1065 bytes
                    return [4 /*yield*/, transactionBuilder.addPostPartiallyVerifiedPriceUpdates(priceUpdateData)];
                case 3:
                    // Post the price updates to ephemeral accounts, one per price feed.
                    // Using this method we can post the price update in a single transaction.
                    // With 5 signatures, the transaction size is 1197 bytes
                    // With 3 signatures, the transaction size is 1065 bytes
                    _c.sent();
                    console.log("The SOL/USD price update will get posted to:", transactionBuilder.getPriceUpdateAccount(SOL_PRICE_FEED_ID).toBase58());
                    return [4 /*yield*/, transactionBuilder.addPriceConsumerInstructions(function (getPriceUpdateAccount) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                // You can generate instructions here that use the price updates posted above.
                                // getPriceUpdateAccount(<price feed id>) will give you the account you need.
                                // These accounts will be packed into transactions by the builder.
                                return [2 /*return*/, []];
                            });
                        }); })];
                case 4:
                    _c.sent();
                    _b = (_a = pythSolanaReceiver.provider).sendAll;
                    return [4 /*yield*/, transactionBuilder.buildVersionedTransactions({
                            computeUnitPriceMicroLamports: 100000,
                        })];
                case 5: 
                // Send the instructions in the builder in 1 or more transactions.
                // The builder will pack the instructions into transactions automatically.
                return [4 /*yield*/, _b.apply(_a, [_c.sent(), { preflightCommitment: "processed" }])];
                case 6:
                    // Send the instructions in the builder in 1 or more transactions.
                    // The builder will pack the instructions into transactions automatically.
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Fetch price update data from Hermes
function getPriceUpdateData() {
    return __awaiter(this, void 0, void 0, function () {
        var priceServiceConnection, response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    priceServiceConnection = new hermes_client_1.HermesClient("https://pyth.dourolabs.app/hermes", HERMES_ACCESS_TOKEN ? { accessToken: HERMES_ACCESS_TOKEN } : {});
                    return [4 /*yield*/, priceServiceConnection.getLatestPriceUpdates([SOL_PRICE_FEED_ID], { encoding: "base64" })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.binary.data];
            }
        });
    });
}
// Load a solana keypair from an id.json file
function loadKeypairFromFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var keypairData, _a, _b, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, fs_1.default.promises.readFile(filePath, "utf8")];
                case 1:
                    keypairData = _b.apply(_a, [_c.sent()]);
                    return [2 /*return*/, web3_js_1.Keypair.fromSecretKey(Uint8Array.from(keypairData))];
                case 2:
                    error_1 = _c.sent();
                    throw new Error("Error loading keypair from file: ".concat(error_1));
                case 3: return [2 /*return*/];
            }
        });
    });
}
main();

"use strict";
/** biome-ignore-all lint/suspicious/noConsole: progress output of a CLI script */
/** biome-ignore-all lint/style/noProcessEnv: CLI script, the token is an ambient secret */
/** biome-ignore-all lint/nursery/noUndeclaredEnvVars: not run as a turbo task */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var yargs_1 = require("yargs");
var helpers_1 = require("yargs/helpers");
var base_1 = require("../src/core/base");
var governance_1 = require("../src/node/utils/governance");
var svm_guardian_set_migration_1 = require("./svm_guardian_set_migration");
var SOL_USD_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
var parser = (0, yargs_1.default)((0, helpers_1.hideBin)(process.argv))
    .usage("Executes the SVM Wormhole guardian set migration once the multisig has approved it.\n" +
    "Usage: $0 --config-path <path> --ops-key-path <path> --proposal <address>")
    .options(__assign(__assign({}, svm_guardian_set_migration_1.MIGRATION_OPTIONS), { "hermes-token": {
        default: process.env.PYTH_API_KEY,
        desc: "Bearer token for the Hermes instance",
        type: "string",
    }, "hermes-url": {
        default: "https://pyth.dourolabs.app/hermes",
        desc: "Hermes instance to pull the price update for the final check from",
        type: "string",
    } }));
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var argv, config, state, wallet, targets, senderPrivateKey, _i, targets_1, target, _a, targets_2, target, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0: return [4 /*yield*/, parser.argv];
                case 1:
                    argv = _g.sent();
                    config = (0, svm_guardian_set_migration_1.loadMigrationConfig)(argv["config-path"]);
                    state = (0, svm_guardian_set_migration_1.readMigrationTargetState)(config, (0, base_1.toDeploymentType)(argv["deployment-type"]));
                    wallet = (0, governance_1.loadHotWallet)(argv["ops-key-path"]);
                    targets = (0, svm_guardian_set_migration_1.resolveMigrationTargets)(config, argv.chain, wallet.publicKey);
                    senderPrivateKey = (0, base_1.toPrivateKey)(Buffer.from(wallet.payer.secretKey.subarray(0, 32)).toString("hex"));
                    _i = 0, targets_1 = targets;
                    _g.label = 2;
                case 2:
                    if (!(_i < targets_1.length)) return [3 /*break*/, 6];
                    target = targets_1[_i];
                    return [4 /*yield*/, setDataSourcesAndFee(target, state, wallet)];
                case 3:
                    _g.sent();
                    return [4 /*yield*/, (0, svm_guardian_set_migration_1.closeGuardianSets)(target, state, senderPrivateKey)];
                case 4:
                    _g.sent();
                    _g.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 2];
                case 6:
                    _a = 0, targets_2 = targets;
                    _g.label = 7;
                case 7:
                    if (!(_a < targets_2.length)) return [3 /*break*/, 11];
                    target = targets_2[_a];
                    console.log("\n=== ".concat(target.chain.getId(), " (governed by ").concat(target.signer.toBase58(), ")"));
                    _c = (_b = console).log;
                    return [4 /*yield*/, (0, svm_guardian_set_migration_1.describeChainState)(target)];
                case 8:
                    _c.apply(_b, [_g.sent()]);
                    console.log("post-migration price relay from ".concat(argv["hermes-url"]));
                    _e = (_d = console).log;
                    _f = "  ".concat;
                    return [4 /*yield*/, (0, svm_guardian_set_migration_1.relayPriceUpdate)(target, wallet, {
                            feedId: SOL_USD_FEED_ID,
                            token: argv["hermes-token"],
                            url: argv["hermes-url"],
                        })];
                case 9:
                    _e.apply(_d, [_f.apply("  ", [_g.sent()])]);
                    _g.label = 10;
                case 10:
                    _a++;
                    return [3 /*break*/, 7];
                case 11: return [2 /*return*/];
            }
        });
    });
}
function setDataSourcesAndFee(target, state, wallet) {
    return __awaiter(this, void 0, void 0, function () {
        var instructions, _a, transaction, _i, instructions_1, instruction, signature;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, target.receiver.generateSetDataSourcesInstruction(wallet.publicKey, state.dataSources)];
                case 1:
                    _a = [
                        _b.sent()
                    ];
                    return [4 /*yield*/, target.receiver.generateSetFeeInstruction(wallet.publicKey, state.singleUpdateFeeInLamports)];
                case 2:
                    instructions = _a.concat([
                        _b.sent()
                    ]);
                    transaction = new web3_js_1.Transaction().add(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));
                    for (_i = 0, instructions_1 = instructions; _i < instructions_1.length; _i++) {
                        instruction = instructions_1[_i];
                        transaction.add(instruction);
                    }
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(target.chain.getConnection(), transaction, [wallet.payer])];
                case 3:
                    signature = _b.sent();
                    console.log("".concat(target.chain.getId(), ": set data sources and fee in ").concat(signature));
                    return [2 /*return*/];
            }
        });
    });
}
await main();

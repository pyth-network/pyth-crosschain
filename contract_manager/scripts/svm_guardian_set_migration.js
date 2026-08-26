"use strict";
/**
 * Shared plumbing for the propose and execute halves of the SVM Wormhole guardian set migration.
 *
 * Per chain the migration is three authority-gated actions — `set_data_sources`, `set_fee` and a
 * core bridge upgrade — then two permissionless ones that only exist in the upgraded program:
 * `close_guardian_set` for every set that is left, and `initialize` to install the Pyth multisig
 * at guardian set 0.
 */
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIGRATION_OPTIONS = void 0;
exports.loadMigrationConfig = loadMigrationConfig;
exports.getVaultOrThrow = getVaultOrThrow;
exports.readMigrationTargetState = readMigrationTargetState;
exports.resolveMigrationTargets = resolveMigrationTargets;
exports.buildMigrationInstructions = buildMigrationInstructions;
exports.describeChainState = describeChainState;
exports.relayPriceUpdate = relayPriceUpdate;
exports.checkAuthorities = checkAuthorities;
exports.checkUpgradeBuffer = checkUpgradeBuffer;
exports.isCoreBridgeMigrated = isCoreBridgeMigrated;
exports.isReceiverMigrated = isReceiverMigrated;
exports.closeGuardianSets = closeGuardianSets;
var node_crypto_1 = require("node:crypto");
var node_fs_1 = require("node:fs");
var hermes_client_1 = require("@pythnetwork/hermes-client");
var pyth_solana_receiver_1 = require("@pythnetwork/pyth-solana-receiver");
var xc_admin_common_1 = require("@pythnetwork/xc-admin-common");
var web3_js_1 = require("@solana/web3.js");
var base_1 = require("../src/core/base");
var chains_1 = require("../src/core/chains");
var contracts_1 = require("../src/core/contracts");
var store_1 = require("../src/node/utils/store");
exports.MIGRATION_OPTIONS = {
    chain: {
        desc: "Only migrate these chains, out of the ones the config lists. Defaults to all of them",
        string: true,
        type: "array",
    },
    "config-path": {
        demandOption: true,
        desc: "Path to the migration config file",
        type: "string",
    },
    "deployment-type": {
        choices: ["pro-compatible-production", "pro-compatible-staging"],
        default: "pro-compatible-production",
        desc: "Which Pyth Pro deployment the chains are being migrated onto. Must match the core bridge artifact: the staging guardians are what a core bridge built with the `beta` feature installs",
        type: "string",
    },
    "ops-key-path": {
        demandOption: true,
        desc: "Path to the ops key file. Signs the multisig transactions, and pays for everything the execute script sends",
        type: "string",
    },
    "rpc-url": {
        desc: "Solana RPC URL to reach the vault's cluster on. Defaults to the public RPC for that cluster",
        type: "string",
    },
    vault: {
        default: "mainnet-beta_FVQyHcooAtThJ83XFrNnv74BcinbRH3bRmfFamAHBfuj",
        desc: "Vault ID of the multisig that governs the chains being migrated",
        type: "string",
    },
};
function loadMigrationConfig(configPath) {
    return JSON.parse((0, node_fs_1.readFileSync)(configPath, "utf8"));
}
function getVaultOrThrow(vaultId) {
    var vault = store_1.DefaultStore.vaults[vaultId];
    if (!vault) {
        throw new Error("Vault with ID '".concat(vaultId, "' does not exist."));
    }
    return vault;
}
function readMigrationTargetState(config, deploymentType) {
    var _a = (0, base_1.getDefaultDeploymentConfig)(deploymentType), dataSources = _a.dataSources, initialSingleUpdateFee = _a.initialSingleUpdateFee, wormholeConfig = _a.wormholeConfig;
    return {
        coreBridgeElf: (0, node_fs_1.readFileSync)(config.coreBridgeArtifact),
        dataSources: dataSources,
        guardianSet: wormholeConfig.initialGuardianSet,
        singleUpdateFeeInLamports: BigInt(initialSingleUpdateFee),
    };
}
function resolveMigrationTargets(config, chainFilter, vaultAuthority) {
    var entries = chainFilter
        ? config.chains.filter(function (entry) { return chainFilter.includes(entry.chain); })
        : config.chains;
    if (chainFilter && entries.length !== chainFilter.length) {
        throw new Error("The config does not cover every requested chain; it has ".concat(config.chains
            .map(function (entry) { return entry.chain; })
            .join(", ")));
    }
    return entries.map(function (entry) {
        var chain = store_1.DefaultStore.getChainOrThrow(entry.chain, chains_1.SvmChain);
        return {
            chain: chain,
            receiver: findContract(store_1.DefaultStore.contracts, contracts_1.SvmPriceFeedContract, chain),
            signer: chain.isRemote ? (0, xc_admin_common_1.mapKey)(vaultAuthority) : vaultAuthority,
            upgradeBuffer: entry.upgradeBuffer ? new web3_js_1.PublicKey(entry.upgradeBuffer) : undefined,
            wormhole: findContract(store_1.DefaultStore.wormhole_contracts, contracts_1.SvmWormholeContract, chain),
        };
    });
}
function findContract(contracts, type, chain) {
    var matches = Object.values(contracts).filter(function (contract) {
        return contract instanceof type && contract.getChain().getId() === chain.getId();
    });
    var match = matches[0];
    if (!match || matches.length > 1) {
        throw new Error("Expected exactly one contract for ".concat(chain.getId(), ", found ").concat(matches.length));
    }
    return match;
}
function buildMigrationInstructions(target, state) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!target.upgradeBuffer) {
                        throw new Error("this script requires an upgrade buffer");
                    }
                    return [4 /*yield*/, target.receiver.generateSetDataSourcesInstruction(target.signer, state.dataSources)];
                case 1:
                    _a = [
                        _b.sent()
                    ];
                    return [4 /*yield*/, target.receiver.generateSetFeeInstruction(target.signer, state.singleUpdateFeeInLamports)];
                case 2: return [2 /*return*/, _a.concat([
                        _b.sent(),
                        target.wormhole.generateUpgradeInstruction(target.upgradeBuffer, target.signer, target.signer)
                    ])];
            }
        });
    });
}
function describeChainState(target) {
    return __awaiter(this, void 0, void 0, function () {
        var chain, receiver, wormhole, lines, _a, _b, _c, _d, receiverConfig, _e, _f, _g, _h, _j, _k, _l, _m, bridgeConfig, guardianSets, _o, _p, _q, _r, currentSet;
        var _s, _t;
        return __generator(this, function (_u) {
            switch (_u.label) {
                case 0:
                    chain = target.chain, receiver = target.receiver, wormhole = target.wormhole;
                    lines = [];
                    if (!chain.isRemote) return [3 /*break*/, 2];
                    _b = (_a = lines).push;
                    _c = ["remote executor ".concat(xc_admin_common_1.REMOTE_EXECUTOR_ADDRESS.toBase58())];
                    _d = "  upgrade authority: ".concat;
                    return [4 /*yield*/, describeUpgradeAuthority(chain, xc_admin_common_1.REMOTE_EXECUTOR_ADDRESS)];
                case 1:
                    _b.apply(_a, _c.concat([_d.apply("  upgrade authority: ", [_u.sent()])]));
                    _u.label = 2;
                case 2: return [4 /*yield*/, receiver.getConfig()];
                case 3:
                    receiverConfig = _u.sent();
                    _f = (_e = lines).push;
                    _g = ["price receiver ".concat(receiver.getProgramId().toBase58())];
                    _h = "  upgrade authority: ".concat;
                    return [4 /*yield*/, describeUpgradeAuthority(chain, receiver.getProgramId())];
                case 4:
                    _f.apply(_e, _g.concat([_h.apply("  upgrade authority: ", [_u.sent()]), "  config ".concat(receiver.getConfigAddress().toBase58()), "    governance authority: ".concat(receiverConfig.governanceAuthority.toBase58()), "    target governance authority: ".concat((_t = (_s = receiverConfig.targetGovernanceAuthority) === null || _s === void 0 ? void 0 : _s.toBase58()) !== null && _t !== void 0 ? _t : "none"), "    core bridge: ".concat(receiverConfig.wormhole.toBase58()), "    minimum signatures: ".concat(receiverConfig.minimumSignatures), "    single update fee: ".concat(receiverConfig.singleUpdateFeeInLamports, " lamports"), "    data sources: ".concat(describeList(receiverConfig.validDataSources.map(function (source) { return "".concat(source.emitterChain, "/").concat(source.emitterAddress); })))]));
                    _k = (_j = lines).push;
                    _l = ["push oracle ".concat(pyth_solana_receiver_1.DEFAULT_PUSH_ORACLE_PROGRAM_ID.toBase58())];
                    _m = "  upgrade authority: ".concat;
                    return [4 /*yield*/, describeUpgradeAuthority(chain, pyth_solana_receiver_1.DEFAULT_PUSH_ORACLE_PROGRAM_ID)];
                case 5:
                    _k.apply(_j, _l.concat([_m.apply("  upgrade authority: ", [_u.sent()])]));
                    return [4 /*yield*/, wormhole.getConfig()];
                case 6:
                    bridgeConfig = _u.sent();
                    return [4 /*yield*/, wormhole.getGuardianSets()];
                case 7:
                    guardianSets = _u.sent();
                    _p = (_o = lines).push;
                    _q = ["core bridge ".concat(wormhole.getProgramId().toBase58())];
                    _r = "  upgrade authority: ".concat;
                    return [4 /*yield*/, describeUpgradeAuthority(chain, wormhole.getProgramId())];
                case 8:
                    _p.apply(_o, _q.concat([_r.apply("  upgrade authority: ", [_u.sent()]), "  config ".concat(wormhole.getConfigAddress().toBase58()), "    guardian set index: ".concat(bridgeConfig.guardianSetIndex), "    guardian set ttl: ".concat(bridgeConfig.guardianSetTtlSeconds, " seconds"), "    message fee: ".concat(bridgeConfig.feeLamports, " lamports"), "  guardian sets still present: ".concat(describeList(guardianSets.map(function (set) { return String(set.index); })))]));
                    currentSet = guardianSets.find(function (set) { return set.index === bridgeConfig.guardianSetIndex; });
                    if (currentSet) {
                        lines.push.apply(lines, __spreadArray(["  guardian set ".concat(currentSet.index, " ").concat(wormhole.getGuardianSetAddress(currentSet.index).toBase58()), "    created: ".concat(describeTimestamp(currentSet.creationTime)), "    expires: ".concat(currentSet.expirationTime === 0 ? "never" : describeTimestamp(currentSet.expirationTime)), "    guardians: ".concat(currentSet.keys.length)], currentSet.keys.map(function (key) { return "      ".concat(key); }), false));
                    }
                    else {
                        lines.push("  guardian set ".concat(bridgeConfig.guardianSetIndex, " is the current one but has already been closed"));
                    }
                    return [2 /*return*/, lines.join("\n")];
            }
        });
    });
}
// Nothing in the state dump is worth failing a run over.
function describeUpgradeAuthority(chain, programId) {
    return __awaiter(this, void 0, void 0, function () {
        var authority, error_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, contracts_1.getUpgradeAuthority)(chain, programId)];
                case 1:
                    authority = _b.sent();
                    return [2 /*return*/, (_a = authority === null || authority === void 0 ? void 0 : authority.toBase58()) !== null && _a !== void 0 ? _a : "none (the program is immutable)"];
                case 2:
                    error_1 = _b.sent();
                    return [2 /*return*/, "unavailable: ".concat(error_1 instanceof Error ? error_1.message : error_1)];
                case 3: return [2 /*return*/];
            }
        });
    });
}
function describeList(values) {
    return values.length > 0 ? values.join(", ") : "none";
}
function describeTimestamp(unixSeconds) {
    return "".concat(unixSeconds, " (").concat(new Date(unixSeconds * 1000).toISOString(), ")");
}
var MAX_PRICE_AGE_SECONDS = 120;
/**
 * Relays one price update from `hermes` through `target`'s receiver and reads the resulting
 * `PriceUpdateV2` back. The only check that exercises the guardians' signatures, the core bridge's
 * quorum and the receiver's data source at once.
 */
function relayPriceUpdate(target, wallet, hermes) {
    return __awaiter(this, void 0, void 0, function () {
        var chainId, client, updateData, receiver, builder, priceUpdateAccount, _a, _b, update, feedId, publishTime, age, closeBuilder, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    chainId = target.chain.getId();
                    client = new hermes_client_1.HermesClient(hermes.url, __assign({}, (hermes.token === undefined ? {} : { accessToken: hermes.token })));
                    return [4 /*yield*/, client.getLatestPriceUpdates([hermes.feedId], { encoding: "base64" })];
                case 1:
                    updateData = (_e.sent()).binary.data[0];
                    if (!updateData) {
                        throw new Error("Hermes returned no update for ".concat(hermes.feedId));
                    }
                    receiver = new pyth_solana_receiver_1.PythSolanaReceiver({
                        connection: target.chain.getConnection(),
                        receiverProgramId: target.receiver.getProgramId(),
                        wallet: wallet,
                        wormholeProgramId: target.wormhole.getProgramId(),
                    });
                    builder = receiver.newTransactionBuilder({
                        closeUpdateAccounts: false,
                    });
                    return [4 /*yield*/, builder.addPostPriceUpdates([updateData])];
                case 2:
                    _e.sent();
                    priceUpdateAccount = builder.getPriceUpdateAccount(hermes.feedId);
                    _b = (_a = receiver.provider).sendAll;
                    return [4 /*yield*/, builder.buildVersionedTransactions({})];
                case 3: return [4 /*yield*/, _b.apply(_a, [_e.sent()])];
                case 4:
                    _e.sent();
                    return [4 /*yield*/, receiver.fetchPriceUpdateAccount(priceUpdateAccount)];
                case 5:
                    update = _e.sent();
                    if (!update) {
                        throw new Error("".concat(chainId, ": ").concat(priceUpdateAccount.toBase58(), " was not written"));
                    }
                    feedId = "0x" + Buffer.from(update.priceMessage.feedId).toString("hex");
                    if (feedId !== hermes.feedId) {
                        throw new Error("".concat(chainId, ": relayed update is for ").concat(feedId, ", expected ").concat(hermes.feedId));
                    }
                    publishTime = update.priceMessage.publishTime.toNumber();
                    age = Math.floor(Date.now() / 1000) - publishTime;
                    if (age > MAX_PRICE_AGE_SECONDS) {
                        throw new Error("".concat(chainId, ": relayed update was published ").concat(age, "s ago, which is not a fresh price"));
                    }
                    closeBuilder = receiver.newTransactionBuilder({
                        closeUpdateAccounts: false,
                    });
                    closeBuilder.addInstructions(builder.closeInstructions);
                    _d = (_c = receiver.provider).sendAll;
                    return [4 /*yield*/, closeBuilder.buildVersionedTransactions({})];
                case 6: return [4 /*yield*/, _d.apply(_c, [_e.sent()])];
                case 7:
                    _e.sent();
                    return [2 /*return*/, "relayed ".concat(feedId, " published at ").concat(publishTime, " (").concat(age, "s ago), verification ").concat(Object.keys(update.verificationLevel).join())];
            }
        });
    });
}
// A chain whose authorities have not been handed over yet should fail here rather than as an
// unexecutable proposal.
function checkAuthorities(target) {
    return __awaiter(this, void 0, void 0, function () {
        var governanceAuthority, upgradeAuthority;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, target.receiver.getConfig()];
                case 1:
                    governanceAuthority = (_b.sent()).governanceAuthority;
                    if (!governanceAuthority.equals(target.signer)) {
                        throw new Error("".concat(target.chain.getId(), ": receiver governance authority is ").concat(governanceAuthority.toBase58(), ", expected ").concat(target.signer.toBase58()));
                    }
                    return [4 /*yield*/, target.wormhole.getUpgradeAuthority()];
                case 2:
                    upgradeAuthority = _b.sent();
                    if (!(upgradeAuthority === null || upgradeAuthority === void 0 ? void 0 : upgradeAuthority.equals(target.signer))) {
                        throw new Error("".concat(target.chain.getId(), ": core bridge upgrade authority is ").concat((_a = upgradeAuthority === null || upgradeAuthority === void 0 ? void 0 : upgradeAuthority.toBase58()) !== null && _a !== void 0 ? _a : "none (the program is immutable)", ", expected ").concat(target.signer.toBase58()));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
// Commits the proposal to an ELF that has been read rather than to an address that is trusted.
function checkUpgradeBuffer(target, state) {
    return __awaiter(this, void 0, void 0, function () {
        var account, authority;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!target.upgradeBuffer) {
                        throw new Error("this script requires an upgrade buffer");
                    }
                    return [4 /*yield*/, target.chain
                            .getConnection()
                            .getAccountInfo(target.upgradeBuffer)];
                case 1:
                    account = _a.sent();
                    if (!(account === null || account === void 0 ? void 0 : account.owner.equals(xc_admin_common_1.BPF_UPGRADABLE_LOADER))) {
                        throw new Error("".concat(target.chain.getId(), ": ").concat(target.upgradeBuffer.toBase58(), " is not a BPF loader account"));
                    }
                    // A `Buffer` is the loader state at discriminant 1, followed by its `Option<Pubkey>` authority.
                    if (account.data.readUInt32LE(0) !== 1) {
                        throw new Error("".concat(target.chain.getId(), ": ").concat(target.upgradeBuffer.toBase58(), " is not an upgrade buffer"));
                    }
                    authority = new web3_js_1.PublicKey(account.data.subarray(5, 37));
                    if (!authority.equals(target.signer)) {
                        throw new Error("".concat(target.chain.getId(), ": buffer authority is ").concat(authority.toBase58(), ", expected ").concat(target.signer.toBase58(), "; the loader will not let the vault upgrade from it"));
                    }
                    checkElf("".concat(target.chain.getId(), ": buffer ").concat(target.upgradeBuffer.toBase58()), account.data.subarray(xc_admin_common_1.BUFFER_METADATA_SIZE), state.coreBridgeElf);
                    return [2 /*return*/];
            }
        });
    });
}
// Gates closing the guardian sets: `close_guardian_set` and the new `initialize` only exist in
// the migrated program, and on a remote chain the message installing it can only be relayed while
// the Wormhole guardian sets are still there to verify it.
function isCoreBridgeMigrated(target, state) {
    return __awaiter(this, void 0, void 0, function () {
        var account;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, target.chain
                        .getConnection()
                        .getAccountInfo((0, xc_admin_common_1.getProgramDataAddress)(target.wormhole.getProgramId()))];
                case 1:
                    account = _a.sent();
                    if (!account) {
                        throw new Error("".concat(target.chain.getId(), ": core bridge has no program data account"));
                    }
                    return [2 /*return*/, account.data
                            .subarray(xc_admin_common_1.PROGRAMDATA_METADATA_SIZE, xc_admin_common_1.PROGRAMDATA_METADATA_SIZE + state.coreBridgeElf.length)
                            .equals(state.coreBridgeElf)];
            }
        });
    });
}
function isReceiverMigrated(target, state) {
    return __awaiter(this, void 0, void 0, function () {
        var config;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, target.receiver.getConfig()];
                case 1:
                    config = _a.sent();
                    return [2 /*return*/, (config.singleUpdateFeeInLamports === state.singleUpdateFeeInLamports &&
                            config.validDataSources.length === state.dataSources.length &&
                            config.validDataSources.every(function (source, index) {
                                var expected = state.dataSources[index];
                                return (source.emitterChain === (expected === null || expected === void 0 ? void 0 : expected.emitterChain) &&
                                    source.emitterAddress === expected.emitterAddress);
                            }))];
            }
        });
    });
}
// A program ELF is allocated at least as large as the ELF and zero-padded, so the leading bytes
// plus an all-zero tail identify it exactly.
function checkElf(label, actual, expected) {
    var head = actual.subarray(0, expected.length);
    if (!head.equals(expected) ||
        actual.subarray(expected.length).some(Boolean)) {
        throw new Error("".concat(label, " holds a different program: sha256 ").concat(sha256(head), " over ").concat(actual.length, " bytes, expected ").concat(sha256(expected), " over ").concat(expected.length, " bytes"));
    }
}
function sha256(data) {
    return (0, node_crypto_1.createHash)("sha256").update(data).digest("hex");
}
// Both instructions go in one transaction: until the close lands, the receiver trusts the Pyth
// Pro emitter while the Wormhole guardians still control the bridge.
function closeGuardianSets(target, state, senderPrivateKey) {
    return __awaiter(this, void 0, void 0, function () {
        var chainId, guardianSets, migrated, toClose, payer, transaction, _i, toClose_1, set, signature;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    chainId = target.chain.getId();
                    return [4 /*yield*/, isReceiverMigrated(target, state)];
                case 1:
                    if (!(_a.sent())) {
                        throw new Error("".concat(chainId, ": the receiver does not accept the Pyth Pro data sources yet; the governance message has not been executed there"));
                    }
                    return [4 /*yield*/, isCoreBridgeMigrated(target, state)];
                case 2:
                    // On a chain the vault reaches over wormhole, the governance message is verified against the
                    // very sets being closed.
                    if (!(_a.sent())) {
                        throw new Error("".concat(chainId, ": the core bridge is still running the pre-migration build; it has to be upgraded before any guardian set is closed"));
                    }
                    return [4 /*yield*/, target.wormhole.getGuardianSets()];
                case 3:
                    guardianSets = _a.sent();
                    migrated = guardianSets.find(function (set) {
                        return set.index === 0 &&
                            set.keys.length === state.guardianSet.length &&
                            set.keys.every(function (key, index) { return key === state.guardianSet[index]; });
                    });
                    toClose = guardianSets
                        .filter(function (set) { return set !== migrated; })
                        .sort(function (a, b) { return b.index - a.index; });
                    if (migrated && toClose.length === 0) {
                        console.log("".concat(chainId, ": guardian set already migrated"));
                        return [2 /*return*/];
                    }
                    payer = target.chain.getKeypair(senderPrivateKey);
                    transaction = new web3_js_1.Transaction().add(web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }));
                    for (_i = 0, toClose_1 = toClose; _i < toClose_1.length; _i++) {
                        set = toClose_1[_i];
                        transaction.add(target.wormhole.generateCloseGuardianSetInstruction(payer.publicKey, set.index));
                    }
                    if (!migrated) {
                        transaction.add(target.wormhole.generateInitializeInstruction(payer.publicKey));
                    }
                    return [4 /*yield*/, (0, web3_js_1.sendAndConfirmTransaction)(target.chain.getConnection(), transaction, [payer])];
                case 4:
                    signature = _a.sent();
                    console.log("".concat(chainId, ": closed guardian sets ").concat(toClose
                        .map(function (set) { return set.index; })
                        .join(", ")).concat(migrated ? "" : " and re-initialized", " in ").concat(signature));
                    return [2 /*return*/];
            }
        });
    });
}

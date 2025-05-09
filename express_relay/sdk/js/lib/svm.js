"use strict";
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null)
      for (var k in mod)
        if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
          __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfigRouterPda = getConfigRouterPda;
exports.getExpressRelayMetadataPda = getExpressRelayMetadataPda;
exports.constructSubmitBidInstruction = constructSubmitBidInstruction;
exports.constructSvmBid = constructSvmBid;
exports.getExpressRelaySvmConfig = getExpressRelaySvmConfig;
const web3_js_1 = require("@solana/web3.js");
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const idlExpressRelay_json_1 = __importDefault(
  require("./idl/idlExpressRelay.json"),
);
const const_1 = require("./const");
const nodewallet_1 = __importDefault(
  require("@coral-xyz/anchor/dist/cjs/nodewallet"),
);
function getExpressRelayProgram(chain) {
  if (!const_1.SVM_CONSTANTS[chain]) {
    throw new Error(`Chain ${chain} not supported`);
  }
  return const_1.SVM_CONSTANTS[chain].expressRelayProgram;
}
function getConfigRouterPda(chain, router) {
  const expressRelayProgram = getExpressRelayProgram(chain);
  return web3_js_1.PublicKey.findProgramAddressSync(
    [Buffer.from("config_router"), router.toBuffer()],
    expressRelayProgram,
  )[0];
}
function getExpressRelayMetadataPda(chain) {
  const expressRelayProgram = getExpressRelayProgram(chain);
  return web3_js_1.PublicKey.findProgramAddressSync(
    [Buffer.from("metadata")],
    expressRelayProgram,
  )[0];
}
async function constructSubmitBidInstruction(
  searcher,
  router,
  permissionKey,
  bidAmount,
  deadline,
  chainId,
  relayerSigner,
  feeReceiverRelayer,
) {
  const expressRelay = new anchor_1.Program(idlExpressRelay_json_1.default, {});
  const configRouter = getConfigRouterPda(chainId, router);
  const expressRelayMetadata = getExpressRelayMetadataPda(chainId);
  const svmConstants = const_1.SVM_CONSTANTS[chainId];
  const ixSubmitBid = await expressRelay.methods
    .submitBid({
      deadline,
      bidAmount,
    })
    .accountsStrict({
      searcher,
      relayerSigner,
      permission: permissionKey,
      router,
      configRouter,
      expressRelayMetadata,
      feeReceiverRelayer,
      systemProgram: anchor.web3.SystemProgram.programId,
      sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
    })
    .instruction();
  ixSubmitBid.programId = svmConstants.expressRelayProgram;
  return ixSubmitBid;
}
async function constructSvmBid(
  tx,
  searcher,
  router,
  permissionKey,
  bidAmount,
  deadline,
  chainId,
  relayerSigner,
  feeReceiverRelayer,
) {
  const ixSubmitBid = await constructSubmitBidInstruction(
    searcher,
    router,
    permissionKey,
    bidAmount,
    deadline,
    chainId,
    relayerSigner,
    feeReceiverRelayer,
  );
  tx.instructions.unshift(ixSubmitBid);
  return {
    transaction: tx,
    chainId: chainId,
    env: "svm",
  };
}
async function getExpressRelaySvmConfig(chainId, connection) {
  const provider = new anchor_1.AnchorProvider(
    connection,
    new nodewallet_1.default(new web3_js_1.Keypair()),
  );
  const expressRelay = new anchor_1.Program(
    idlExpressRelay_json_1.default,
    provider,
  );
  const metadata = await expressRelay.account.expressRelayMetadata.fetch(
    getExpressRelayMetadataPda(chainId),
  );
  return {
    feeReceiverRelayer: metadata.feeReceiverRelayer,
    relayerSigner: metadata.relayerSigner,
  };
}

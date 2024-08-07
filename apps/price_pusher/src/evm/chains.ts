import { defineChain } from "viem";
import * as viemChains from "viem/chains";
import { Chain } from "viem/chains";

// Get the chain object from the chainId or return an unknown chain object
// if the chainId is not found in the list of chains. Normally the unknown
// chain object should work for most cases, but some networks may have special
// requirements (like custom fee model, etc) that may require a custom chain.
export function getChain(chainId: number): Chain {
  for (const chain of chains) {
    if (chain.id === chainId) {
      return chain;
    }
  }

  return defineChain({
    id: chainId,
    name: "Unknown",
    nativeCurrency: {
      name: "Unknown",
      symbol: "Unknown",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [],
      },
    },
  });
}

// This list is generated from the exported chains in viem/chains.ts
// and is used to validate the chainId in the Chain type
export const chains: Chain[] = [
  viemChains.abstractTestnet,
  viemChains.acala,
  viemChains.ancient8,
  viemChains.ancient8Sepolia,
  viemChains.anvil,
  viemChains.apexTestnet,
  viemChains.arbitrum,
  viemChains.arbitrumGoerli,
  viemChains.arbitrumNova,
  viemChains.astar,
  viemChains.astarZkEVM,
  viemChains.astarZkyoto,
  viemChains.arbitrumSepolia,
  viemChains.areonNetwork,
  viemChains.areonNetworkTestnet,
  viemChains.artelaTestnet,
  viemChains.aurora,
  viemChains.auroraTestnet,
  viemChains.auroria,
  viemChains.avalanche,
  viemChains.avalancheFuji,
  viemChains.b3Sepolia,
  viemChains.bahamut,
  viemChains.base,
  viemChains.baseGoerli,
  viemChains.baseSepolia,
  viemChains.beam,
  viemChains.beamTestnet,
  viemChains.bearNetworkChainMainnet,
  viemChains.bearNetworkChainTestnet,
  viemChains.berachainTestnet,
  viemChains.berachainTestnetbArtio,
  viemChains.bevmMainnet,
  viemChains.bitkub,
  viemChains.bitkubTestnet,
  viemChains.bitTorrent,
  viemChains.bitTorrentTestnet,
  viemChains.blast,
  viemChains.blastSepolia,
  viemChains.bob,
  viemChains.bobSepolia,
  viemChains.boba,
  viemChains.bobaSepolia,
  viemChains.bronos,
  viemChains.bronosTestnet,
  viemChains.bsc,
  viemChains.bscTestnet,
  viemChains.bscGreenfield,
  viemChains.btr,
  viemChains.btrTestnet,
  viemChains.bxn,
  viemChains.bxnTestnet,
  viemChains.canto,
  viemChains.celo,
  viemChains.celoAlfajores,
  viemChains.chiliz,
  viemChains.classic,
  viemChains.confluxESpace,
  viemChains.confluxESpaceTestnet,
  viemChains.coreDao,
  viemChains.crab,
  viemChains.cronos,
  viemChains.cronoszkEVMTestnet,
  viemChains.cronosTestnet,
  viemChains.crossbell,
  viemChains.cyber,
  viemChains.cyberTestnet,
  viemChains.darwinia,
  viemChains.dchain,
  viemChains.dchainTestnet,
  viemChains.defichainEvm,
  viemChains.defichainEvmTestnet,
  viemChains.degen,
  viemChains.dfk,
  viemChains.dodochainTestnet,
  viemChains.dogechain,
  viemChains.dreyerxMainnet,
  viemChains.dreyerxTestnet,
  viemChains.edgeless,
  viemChains.edgelessTestnet,
  viemChains.edgeware,
  viemChains.edgewareTestnet,
  viemChains.eon,
  viemChains.eos,
  viemChains.eosTestnet,
  viemChains.etherlink,
  viemChains.etherlinkTestnet,
  viemChains.evmos,
  viemChains.evmosTestnet,
  viemChains.ekta,
  viemChains.ektaTestnet,
  viemChains.fantom,
  viemChains.fantomSonicTestnet,
  viemChains.fantomTestnet,
  viemChains.fibo,
  viemChains.filecoin,
  viemChains.filecoinCalibration,
  viemChains.filecoinHyperspace,
  viemChains.flare,
  viemChains.flareTestnet,
  viemChains.flowPreviewnet,
  viemChains.flowMainnet,
  viemChains.flowTestnet,
  viemChains.forma,
  viemChains.foundry,
  viemChains.fraxtal,
  viemChains.fraxtalTestnet,
  viemChains.funkiMainnet,
  viemChains.funkiSepolia,
  viemChains.fuse,
  viemChains.fuseSparknet,
  viemChains.iotex,
  viemChains.iotexTestnet,
  viemChains.jbc,
  viemChains.jbcTestnet,
  viemChains.karura,
  viemChains.gobi,
  viemChains.goerli,
  viemChains.gnosis,
  viemChains.gnosisChiado,
  viemChains.gravity,
  viemChains.ham,
  viemChains.hardhat,
  viemChains.harmonyOne,
  viemChains.haqqMainnet,
  viemChains.haqqTestedge2,
  viemChains.hedera,
  viemChains.hederaTestnet,
  viemChains.hederaPreviewnet,
  viemChains.holesky,
  viemChains.immutableZkEvm,
  viemChains.immutableZkEvmTestnet,
  viemChains.inEVM,
  viemChains.kakarotSepolia,
  viemChains.kava,
  viemChains.kavaTestnet,
  viemChains.kcc,
  viemChains.klaytn,
  viemChains.klaytnBaobab,
  viemChains.koi,
  viemChains.kroma,
  viemChains.kromaSepolia,
  viemChains.l3x,
  viemChains.l3xTestnet,
  viemChains.lightlinkPegasus,
  viemChains.lightlinkPhoenix,
  viemChains.linea,
  viemChains.lineaGoerli,
  viemChains.lineaSepolia,
  viemChains.lineaTestnet,
  viemChains.lisk,
  viemChains.liskSepolia,
  viemChains.localhost,
  viemChains.lukso,
  viemChains.luksoTestnet,
  viemChains.lycan,
  viemChains.lyra,
  viemChains.mainnet,
  viemChains.mandala,
  viemChains.manta,
  viemChains.mantaSepoliaTestnet,
  viemChains.mantaTestnet,
  viemChains.mantle,
  viemChains.mantleSepoliaTestnet,
  viemChains.mantleTestnet,
  viemChains.merlin,
  viemChains.metachain,
  viemChains.metachainIstanbul,
  viemChains.metalL2,
  viemChains.meter,
  viemChains.meterTestnet,
  viemChains.metis,
  viemChains.metisGoerli,
  viemChains.mev,
  viemChains.mevTestnet,
  viemChains.mintSepoliaTestnet,
  viemChains.mode,
  viemChains.modeTestnet,
  viemChains.moonbaseAlpha,
  viemChains.moonbeam,
  viemChains.moonbeamDev,
  viemChains.moonriver,
  viemChains.morphHolesky,
  viemChains.morphSepolia,
  viemChains.nautilus,
  viemChains.neonDevnet,
  viemChains.neonMainnet,
  viemChains.nexi,
  viemChains.nexilix,
  viemChains.oasys,
  viemChains.oasisTestnet,
  viemChains.okc,
  viemChains.optimism,
  viemChains.optimismGoerli,
  viemChains.optimismSepolia,
  viemChains.opBNB,
  viemChains.opBNBTestnet,
  viemChains.oortMainnetDev,
  viemChains.otimDevnet,
  viemChains.palm,
  viemChains.palmTestnet,
  viemChains.playfiAlbireo,
  viemChains.pgn,
  viemChains.pgnTestnet,
  viemChains.phoenix,
  viemChains.plinga,
  viemChains.plumeTestnet,
  viemChains.polygon,
  viemChains.polygonAmoy,
  viemChains.polygonMumbai,
  viemChains.polygonZkEvm,
  viemChains.polygonZkEvmCardona,
  viemChains.polygonZkEvmTestnet,
  viemChains.pulsechain,
  viemChains.pulsechainV4,
  viemChains.qMainnet,
  viemChains.qTestnet,
  viemChains.real,
  viemChains.redbellyTestnet,
  viemChains.redstone,
  viemChains.reyaNetwork,
  viemChains.rollux,
  viemChains.rolluxTestnet,
  viemChains.ronin,
  viemChains.root,
  viemChains.rootPorcini,
  viemChains.rootstock,
  viemChains.rootstockTestnet,
  viemChains.rss3,
  viemChains.rss3Sepolia,
  viemChains.saigon,
  viemChains.sapphire,
  viemChains.sapphireTestnet,
  viemChains.satoshiVM,
  viemChains.satoshiVMTestnet,
  viemChains.scroll,
  viemChains.scrollSepolia,
  viemChains.sei,
  viemChains.seiDevnet,
  viemChains.seiTestnet,
  viemChains.sepolia,
  viemChains.shapeSepolia,
  viemChains.shimmer,
  viemChains.shimmerTestnet,
  viemChains.skaleBlockBrawlers,
  viemChains.skaleCalypso,
  viemChains.skaleCalypsoTestnet,
  viemChains.skaleCryptoBlades,
  viemChains.skaleCryptoColosseum,
  viemChains.skaleEuropa,
  viemChains.skaleEuropaTestnet,
  viemChains.skaleExorde,
  viemChains.skaleHumanProtocol,
  viemChains.skaleNebula,
  viemChains.skaleNebulaTestnet,
  viemChains.skaleRazor,
  viemChains.skaleTitan,
  viemChains.skaleTitanTestnet,
  viemChains.sketchpad,
  viemChains.songbird,
  viemChains.songbirdTestnet,
  viemChains.spicy,
  viemChains.shardeumSphinx,
  viemChains.shibarium,
  viemChains.shibariumTestnet,
  viemChains.stratis,
  viemChains.syscoin,
  viemChains.syscoinTestnet,
  viemChains.taraxa,
  viemChains.taiko,
  viemChains.taikoHekla,
  viemChains.taikoJolnir,
  viemChains.taikoKatla,
  viemChains.taikoTestnetSepolia,
  viemChains.taraxaTestnet,
  viemChains.telcoinTestnet,
  viemChains.telos,
  viemChains.telosTestnet,
  viemChains.tenet,
  viemChains.thaiChain,
  viemChains.thunderTestnet,
  viemChains.unreal,
  viemChains.vechain,
  viemChains.wanchain,
  viemChains.wanchainTestnet,
  viemChains.wemix,
  viemChains.wemixTestnet,
  viemChains.xLayerTestnet,
  viemChains.xLayer,
  viemChains.xai,
  viemChains.xaiTestnet,
  viemChains.xdc,
  viemChains.xdcTestnet,
  viemChains.xrSepolia,
  viemChains.yooldoVerse,
  viemChains.yooldoVerseTestnet,
  viemChains.zetachain,
  viemChains.zetachainAthensTestnet,
  viemChains.zhejiang,
  viemChains.zilliqa,
  viemChains.zilliqaTestnet,
  viemChains.zkFair,
  viemChains.zkFairTestnet,
  viemChains.zkLinkNova,
  viemChains.zkLinkNovaSepoliaTestnet,
  viemChains.zksync,
  viemChains.zksyncInMemoryNode,
  viemChains.zksyncSepoliaTestnet,
  viemChains.zora,
  viemChains.zoraSepolia,
  viemChains.zoraTestnet,
  viemChains.zircuitTestnet,
];

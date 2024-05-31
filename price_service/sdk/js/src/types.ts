import { components } from "./serverTypes";

// Accessing schema objects
export type AssetType = components["schemas"]["AssetType"];
export type BinaryPriceUpdate = components["schemas"]["BinaryPriceUpdate"];
export type EncodingType = components["schemas"]["EncodingType"];
export type GetVaaCcipInput = components["schemas"]["GetVaaCcipInput"];
export type GetVaaCcipResponse = components["schemas"]["GetVaaCcipResponse"];
export type GetVaaResponse = components["schemas"]["GetVaaResponse"];
export type ParsedPriceUpdate = components["schemas"]["ParsedPriceUpdate"];
// PriceFeedMetadataV2 because there exists PriceFeedMetadata in PriceFeed.ts
export type PriceFeedMetadataV2 = components["schemas"]["PriceFeedMetadata"];
export type PriceIdInput = components["schemas"]["PriceIdInput"];
export type PriceUpdate = components["schemas"]["PriceUpdate"];
export type RpcPrice = components["schemas"]["RpcPrice"];
export type RpcPriceFeed = components["schemas"]["RpcPriceFeed"];
export type RpcPriceFeedMetadata =
  components["schemas"]["RpcPriceFeedMetadata"];
export type RpcPriceFeedMetadataV2 =
  components["schemas"]["RpcPriceFeedMetadataV2"];
export type RpcPriceIdentifier = components["schemas"]["RpcPriceIdentifier"];

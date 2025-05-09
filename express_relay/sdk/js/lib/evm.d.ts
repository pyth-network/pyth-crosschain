import { Bid, BidParams, OpportunityBid, OpportunityEvm } from "./types";
import { Hex } from "viem";
export declare function signBid(
  opportunity: OpportunityEvm,
  bidParams: BidParams,
  privateKey: Hex,
): Promise<Bid>;
export declare function getSignature(
  opportunity: OpportunityEvm,
  bidParams: BidParams,
  privateKey: Hex,
): Promise<`0x${string}`>;
export declare function signOpportunityBid(
  opportunity: OpportunityEvm,
  bidParams: BidParams,
  privateKey: Hex,
): Promise<OpportunityBid>;
//# sourceMappingURL=evm.d.ts.map

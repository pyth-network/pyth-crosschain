#![allow(dead_code)]
use alloy::sol;

sol!(
    #[sol(rpc)]
   contract ProxyCalls {
     function getPriceUnsafe(bytes32 id) external;
     function getEmaPriceUnsafe(bytes32 id) external;
     function getPriceNoOlderThan(bytes32 id, uint age) external;
     function getEmaPriceNoOlderThan(bytes32 id, uint age) external;
     function getUpdateFee(bytes[] calldata updateData) external returns (uint256);
     function getValidTimePeriod() external;
     function updatePriceFeeds(bytes[] calldata updateData) external payable;
     function updatePriceFeedsIfNecessary(bytes[] calldata updateData, bytes32[] calldata priceIds, uint64[] calldata publishTimes) external payable;
   }
);
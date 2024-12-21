#![allow(dead_code)]
use alloy::sol;

sol!(
    #[sol(rpc)]
   contract ExtendPyth {
     function getPriceUnsafe(bytes32 id) external returns (uint8[] price);
     function getEmaPriceUnsafe(bytes32 id) external returns (uint8[] price);
     function getPriceNoOlderThan(bytes32 id, uint age) external returns (uint8[] price);
     function getEmaPriceNoOlderThan(bytes32 id, uint age) external returns (uint8[] price);
     function getUpdateFee(bytes[] calldata updateData) external returns (uint256 fee);
     function getValidTimePeriod() external returns (uint256 period);
     function updatePriceFeeds(bytes[] calldata updateData) external payable;
     function updatePriceFeedsIfNecessary(bytes[] calldata updateData, bytes32[] calldata priceIds, uint64[] calldata publishTimes) external payable;

     function getData() external returns (uint[] calldata data);
   }
);

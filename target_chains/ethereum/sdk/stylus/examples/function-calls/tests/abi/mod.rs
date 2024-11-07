#![allow(dead_code)]
use alloy::sol;

sol!(
    #[sol(rpc)]
     contract FunctionCalls {
        function getPriceUnsafe() external returns (int64 price);
        function getEmaPriceUnsafe() external returns (int64 price);
        function getPriceNoOlderThan() external returns (int64 price);
        function getEmaPriceNoOlderThan() external returns (int64 price);
        function getUpdateFee() external returns (uint256 fee);
        function getValidTimePeriod() external returns (uint256 period);
        function updatePriceFeeds() external payable;
        function updatePriceFeedsIfNecessary() external payable; 
   }
);
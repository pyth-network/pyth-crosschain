#![allow(dead_code)]
use alloy::sol;

sol!(
    #[sol(rpc)]
     contract FunctionCalls {
        function getPriceUnsafe() external ;
        function getEmaPriceUnsafe() external ;
        function getPriceNoOlderThan() external ;
        function getEmaPriceNoOlderThan() external;
        function getUpdateFee() external;
        function getValidTimePeriod() external;
        function updatePriceFeeds() external payable;
        function updatePriceFeedsIfNecessary() external payable; 
   }
);
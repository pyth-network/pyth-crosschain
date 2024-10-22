use alloy::sol;

// TODO: include file?
sol! {
    pragma solidity ^0.8.13;

    #[sol(rpc)]
    interface DelayedPythPriceReceiver {
        #[derive(Debug)]
        event RequestPythPrice(
            uint256 priceFeedId,
            uint8 delaySeconds,
            bytes context
        );

        #[derive(Debug)]
        function notifyPythPrice(
            bytes calldata update,
            bytes calldata context
        ) external;
    }
}

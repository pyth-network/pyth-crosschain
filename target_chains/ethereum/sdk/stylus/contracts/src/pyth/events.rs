use alloy_sol_types::sol;

sol! {
  event PriceFeedUpdate(
        bytes32 indexed id,
        uint64 publishTime,
        int64 price,
        uint64 conf
    );
}

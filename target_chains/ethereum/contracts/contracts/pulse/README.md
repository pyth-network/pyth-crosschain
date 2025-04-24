# Pyth Pulse Contract

Pyth Pulse is a service that regularly pushes Pyth price updates to on-chain contracts based on configurable conditions. It ensures that on-chain prices remain up-to-date without requiring users to manually update prices or run any infrastructure themselves. This is helpful for users who prefer to consume from a push-style feed rather than integrate the pull model, where users post the price update on-chain immediately before using it.

Users can use Pulse's web interface to subscribe to a set of feeds, configure the update thresholds based on time or price deviation, and Pulse's decentralized keeper network handles the rest — users can then consume the price feeds from the Pyth contract on their chain of choice.

Pulse replaces the service formerly known as "scheduler" or "price pusher," and provides greater stability and operational simplicity.

## Build and Test

Run `forge build` to build the contracts and `forge test` to run the contract unit tests.
The unit tests live in the `../../forge-test` directory.

Gas benchmarks that cover the most frequent usage patterns are in `PulseSchedulerGasBenchmark.t.sol`. Run the benchmark with -vv to to see the gas usage for the operations under test, without setup costs.

## Architecture

Pyth Pulse ensures that on-chain Pyth prices remain up-to-date according to user-defined criteria without requiring end-users to manually push prices or run their own infrastructure. This system revolves around the `Scheduler` contract.

### Actors / Roles

- **Manager:** The owner/creator of a subscription (`subscriptionManager`). They define the subscription parameters (feeds, triggers, whitelist), deposit funds (`addFunds`), and can modify (`updateSubscription`) or deactivate their subscription. Typically an EOA or a protocol controlled by its governance.
- **Reader:** A consumer of the price data stored within a specific subscription. They call read functions (`getPricesUnsafe`, `getEmaPriceUnsafe`) on this contract to get the latest pushed prices. Access can be permissionless or restricted to a whitelist (`readerWhitelist`) defined by the Manager.
- **Provider:** An off-chain, permissionless agent that runs Keeper node(s). Responsible for monitoring subscriptions and pushing updates (`updatePriceFeeds`) when trigger conditions are met. Providers are incentivized economically for successful pushes.
- **Admin:** Controlled by the Pyth Data Association multisig. Responsible for deploying this contract, upgrading it, and configuring system-level parameters.

### Components

1.  **Pulse Contract (This Contract):** Deployed on the target EVM blockchain, this contract manages the state of the subscription metadata and price feeds.
    - Manages user **subscriptions**, storing metadata like the set of desired Pyth price feed IDs, update trigger conditions (time-based heartbeat and/or price deviation percentage), and optional reader whitelists.
    - Receives price updates pushed by providers. Verifies the price updates using the core Pyth protocol contract (`IPyth`).
    - Stores the latest verified price updates for each feed within a subscription.
    - Manages the balance (in native tokens) deposited by subscription managers to pay for updates.
    - Provides functions for users (Readers) to read the latest pushed prices for a subscription.
    - Allows Managers to manage their subscription parameters and funds.
    - Allows Keepers to discover active subscriptions (`getActiveSubscriptions`).
2.  **Keeper Network (Off-Chain):** _Implementation pending._ A permissionless network of off-chain providers.
    - Keepers constantly monitor active subscriptions listed in this Scheduler Contract.
    - They fetch the latest off-chain price data from a Pyth Price Service endpoint (e.g., Hermes).
    - They compare the latest off-chain prices and timestamps with the last prices stored on-chain in this contract for each subscription.
    - If a subscription's trigger conditions (e.g., time since last update > `heartbeatSeconds`, or price deviation > `deviationThresholdBps`) are met, the Keeper submits a transaction to this contract's `updatePriceFeeds` function, including the necessary Pyth price update data.
3.  **Web UI (Off-Chain):** _Implementation pending._ The primary interface for users to interact with Pyth Pulse.
    - Allows users (Managers) to easily create, configure, monitor, and fund their price feed subscriptions by interacting with this Scheduler Contract's functions.

### High level flow

1.  **Subscription:** A Manager calls `createSubscription`, providing `SubscriptionParams` and `msg.value` for the initial balance.
2.  **Monitoring:** Keepers call `getActiveSubscriptions` to find active subscriptions and their parameters.
3.  **Triggering:** Off-chain, a Keeper determines an update is needed based on `SubscriptionParams.updateCriteria` and the last update time (`SubscriptionStatus.priceLastUpdatedAt`).
4.  **Pushing:** The Keeper calls `updatePriceFeeds` with the `subscriptionId` and the Pyth `updateData`.
5.  **Verification & Storage:** The `updatePriceFeeds` function performs several checks (listed below), and stores the updated prices.
    - Verifies that trigger conditions are met and the update is newer than the stored ones.
    - Verifies the provided `updateData` using the core `IPyth` contract (`_state.pyth`).
    - Ensures all price updates within the transaction correspond to the same Pythnet slot using `parsePriceFeedUpdatesWithSlots`.
6.  **Keeper Payment:** The Keeper (`msg.sender`) that successfully lands the update transaction is reimbursed for the transaction costs, plus a premium. The contract dynamically calculates the cost (gas used during the push \* current gas price + fixed overhead + premium) and transfers this amount to the Keeper from the subscription's balance. Payment only occurs if the update conditions were met and the transaction succeeded.
7.  **Reading:** Readers get prices using the `@pythnetwork/pyth-sdk-solidity` SDK. Readers are recommended to use the SDK's functions `get(Ema)PricesNoOlderThan`, which wrap the contract's `get(Ema)PricesUnsafe` functions and validate that the price is recent.

### Keeper Network & Incentives

- Anyone can run a Keeper node; no registration is required to call `updatePriceFeeds`. The main goal of making this component a permissionless network rather a set of permissioned nodes is to enhance reliability for the feeds -- if one provider fails, others should be available to service the subscriptions. We can improve this reliability by sourcing independent providers, and by making it profitable to push updates, paid out by the users of the feeds.

- Keepers are paid directly by the subscription's funds held in this contract for each successful update they perform. The payment covers gas costs plus a premium, and payment is sent directly to `msg.sender` (the keeper) at the end of `updatePriceFeeds`. The first transaction included in a block that passes checks will succeed and receive the payment. Subsequent attempts for the same update interval will revert since we verify the update criteria on-chain. By only allowing updates when they are needed, we keep costs predictable for the users.

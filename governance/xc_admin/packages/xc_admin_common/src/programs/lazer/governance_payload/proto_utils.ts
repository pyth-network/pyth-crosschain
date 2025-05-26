// Import the generated static module
import { pyth_lazer_transaction } from "../generated/governance_instruction";

/** Get commonly used proto types from the generated static module */
export function getProtoTypes() {
  return {
    GovernanceInstruction: pyth_lazer_transaction.GovernanceInstruction,
    GovernanceDirective: pyth_lazer_transaction.GovernanceDirective,
    AddPublisher: pyth_lazer_transaction.AddPublisher,
    UpdatePublisher: pyth_lazer_transaction.UpdatePublisher,
    AddFeed: pyth_lazer_transaction.AddFeed,
    UpdateFeed: pyth_lazer_transaction.UpdateFeed,
    UpdateFeedMetadata: pyth_lazer_transaction.UpdateFeedMetadata,
    ActivateFeed: pyth_lazer_transaction.ActivateFeed,
    DeactivateFeed: pyth_lazer_transaction.DeactivateFeed,
    SetPublisherName: pyth_lazer_transaction.SetPublisherName,
    SetPublisherActive: pyth_lazer_transaction.SetPublisherActive,
    AddPublisherPublicKeys: pyth_lazer_transaction.AddPublisherPublicKeys,
    RemovePublisherPublicKeys: pyth_lazer_transaction.RemovePublisherPublicKeys,
    SetPublisherPublicKeys: pyth_lazer_transaction.SetPublisherPublicKeys,
  };
}

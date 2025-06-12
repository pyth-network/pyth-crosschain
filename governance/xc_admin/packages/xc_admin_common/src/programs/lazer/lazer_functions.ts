import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { PythCluster } from "@pythnetwork/client";
import {
  ValidationResult,
  LazerValidationResult,
  ProgramType,
  LazerConfig,
  LazerState,
  LazerFeedMetadata,
  LazerFeed,
  LazerPublisher,
  ShardChange,
  FeedChange,
  PublisherChange,
  LazerConfigChanges,
} from "../types";
import { pyth_lazer_transaction } from "@pythnetwork/pyth-lazer-state-sdk/governance";
import { ChainName, LazerExecute } from "../..";

/**
 * Converts LazerFeedMetadata to protobuf IMap format using protobufjs fromObject
 * This leverages the built-in protobufjs conversion capabilities
 *
 * @param metadata The LazerFeedMetadata to convert
 * @returns IMap compatible object for protobuf
 */
export function convertLazerFeedMetadataToMap(
  metadata: LazerFeedMetadata,
): pyth_lazer_transaction.DynamicValue.IMap {
  // Convert each metadata field to a DynamicValue
  const items = Object.entries(metadata)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => ({
      key,
      value: {
        // Wrap the value in the appropriate DynamicValue type
        stringValue: typeof value === "string" ? value : undefined,
        intValue: typeof value === "number" ? value : undefined,
        boolValue: typeof value === "boolean" ? value : undefined,
      },
    }));

  return pyth_lazer_transaction.DynamicValue.Map.fromObject({
    items,
  });
}

/**
 * Parameters for getting Lazer configuration
 */
export type LazerConfigParams = {
  // Instead of requiring Solana accounts, allow any parameters needed
  endpoint?: string;
  network?: string;
  options?: Record<string, unknown>;
};

/**
 * Lazer program instruction accounts needed for generateInstructions
 */
export interface LazerInstructionAccounts {
  fundingAccount: PublicKey;
  additionalAccounts?: Record<string, PublicKey>;
}

// Import the sample state directly
// In a real implementation, this would be fetched from an API
const sampleLazerState: LazerState = {
  shardId: 1,
  lastSequenceNo: "1234",
  lastTimestamp: "2025-05-20T16:54:39.348499000Z",
  shardName: "production.tokyo.shard1",
  minRate: "0.001000000s",
  feeds: [
    {
      metadata: {
        feedId: 1,
        name: "CATCOIN",
        symbol: "CAT",
        description: "desc1",
        assetType: "CRYPTO",
        exponent: -9,
        minPublishers: 3,
        minRate: "0.001000000s",
        expiryTime: "5.000000000s",
        isActivated: true,
        hermesId: "id1",
        marketSchedule: "UTC;O,O,O,O,O,O,O;",
      },
    },
    {
      metadata: {
        feedId: 2,
        name: "DUCKCOIN",
        symbol: "DUCKY",
        description: "desc2",
        assetType: "FUNDING_RATE",
        exponent: -12,
        cmcId: 42,
        fundingRateInterval: "3600.000000000s",
        minPublishers: 9,
        minRate: "0.200000000s",
        expiryTime: "5.000000000s",
        isActivated: false,
        quoteCurrency: "USD",
        marketSchedule:
          "America/New_York;O,1234-1347,0930-2359,C,C,C,O;0412/O,0413/C,0414/1234-1347,1230/0930-2359",
      },
      pendingActivation: "2025-05-20T17:54:39.349669000Z",
    },
  ],
  publishers: [
    {
      publisherId: 1,
      name: "lazer.binance",
      publicKeys: ["obiC8z4ePs9LH9tYSYXTsolVF3sQCZyuSWQ35qVCDVQ="],
      isActive: true,
    },
    {
      publisherId: 2,
      name: "jump",
      publicKeys: [
        "HhUU1ODk1xHDhUh24Vfb2UBEk7JWrl9dea3OaCNQrQg=",
        "X727WKFU9kXaoOGdb/ReqGSe/rKM/kJ7Nm6h+u8oEc4=",
      ],
      isActive: true,
    },
  ],
};

/**
 * Program ID for the Pyth Lazer program
 */
export const LAZER_PROGRAM_ID = new PublicKey(
  "pytd2yyk641x7ak7mkaasSJVXh6YYZnC7wTmtgAyxPt",
);

/**
 * Check if the Pyth Lazer program is available on the specified cluster
 *
 * @param cluster The Pyth cluster to check
 * @returns True if the program is available on the cluster
 */
export function isAvailableOnCluster(cluster: PythCluster): boolean {
  return (
    cluster === "pythnet" ||
    cluster === "mainnet-beta" ||
    cluster === "devnet" ||
    cluster === "testnet"
  );
}

/**
 * Get configuration for Lazer program
 *
 * @param params Parameters to fetch Lazer configuration
 * @returns Promise resolving to Lazer-specific configuration object
 */
export function getConfig(params: LazerConfigParams): LazerConfig {
  // Extract the properties
  const { endpoint, network, options } = params;

  // In a real implementation, this would fetch data from an API
  // For now, we're using the sample state

  return {
    programType: ProgramType.PYTH_LAZER,
    state: sampleLazerState,
  };
}

/**
 * Format the configuration for downloading as a JSON file
 *
 * @param config The program's configuration object
 * @returns Configuration formatted for download
 */
export function getDownloadableConfig(config: LazerConfig): LazerState {
  // For Lazer, we just return the state directly as it's already in the correct format
  return config.state;
}

/**
 * Validate an uploaded configuration against the current configuration
 *
 * @param existingConfig Current configuration
 * @param uploadedConfig Configuration from an uploaded file
 * @param cluster The Pyth cluster the configuration is for
 * @returns Object with validation result and optional error message
 */
export function validateUploadedConfig(
  existingConfig: LazerState,
  uploadedConfig: LazerState,
  cluster: PythCluster,
): LazerValidationResult {
  try {
    // Basic type validation
    if (typeof uploadedConfig !== "object" || uploadedConfig === null) {
      return {
        isValid: false,
        error: "Invalid JSON format for Lazer configuration",
      };
    }

    // Cast to LazerState
    const uploadedLazerState = uploadedConfig as LazerState;

    // Check for required fields
    if (
      !("shardId" in uploadedLazerState) ||
      !("feeds" in uploadedLazerState) ||
      !("publishers" in uploadedLazerState)
    ) {
      return {
        isValid: false,
        error: "Missing required fields in Lazer configuration",
      };
    }

    // Calculate changes between existing and uploaded config
    const changes: LazerConfigChanges = {};

    // Compare shard metadata
    if (
      existingConfig.shardId !== uploadedLazerState.shardId ||
      existingConfig.shardName !== uploadedLazerState.shardName ||
      existingConfig.minRate !== uploadedLazerState.minRate
    ) {
      changes["shard"] = {
        prev: {
          shardId: existingConfig.shardId,
          shardName: existingConfig.shardName,
          minRate: existingConfig.minRate,
        },
        new: {
          shardId: uploadedLazerState.shardId,
          shardName: uploadedLazerState.shardName,
          minRate: uploadedLazerState.minRate,
        },
      };
    }

    // Compare feeds
    const existingFeeds = new Map(
      existingConfig.feeds.map((feed) => [feed.metadata.feedId, feed]),
    );
    const uploadedFeeds = new Map(
      uploadedLazerState.feeds.map((feed) => [feed.metadata.feedId, feed]),
    );

    // Find added, removed, and modified feeds
    for (const [id, feed] of existingFeeds.entries()) {
      if (!uploadedFeeds.has(id)) {
        // Feed was removed
        changes[`feed_${id}`] = {
          prev: feed,
          new: undefined,
        };
      } else if (
        JSON.stringify(feed) !== JSON.stringify(uploadedFeeds.get(id))
      ) {
        // Feed was modified
        changes[`feed_${id}`] = {
          prev: feed,
          new: uploadedFeeds.get(id),
        };
      }
    }

    for (const [id, feed] of uploadedFeeds.entries()) {
      if (!existingFeeds.has(id)) {
        // New feed was added
        changes[`feed_${id}`] = {
          prev: undefined,
          new: feed,
        };
      }
    }

    // Compare publishers
    const existingPublishers = new Map(
      existingConfig.publishers.map((pub) => [pub.publisherId, pub]),
    );
    const uploadedPublishers = new Map(
      uploadedLazerState.publishers.map((pub) => [pub.publisherId, pub]),
    );

    // Find added, removed, and modified publishers
    for (const [id, pub] of existingPublishers.entries()) {
      if (!uploadedPublishers.has(id)) {
        // Publisher was removed
        changes[`publisher_${id}`] = {
          prev: pub,
          new: undefined,
        };
      } else if (
        JSON.stringify(pub) !== JSON.stringify(uploadedPublishers.get(id))
      ) {
        // Publisher was modified
        changes[`publisher_${id}`] = {
          prev: pub,
          new: uploadedPublishers.get(id),
        };
      }
    }

    for (const [id, pub] of uploadedPublishers.entries()) {
      if (!existingPublishers.has(id)) {
        // New publisher was added
        changes[`publisher_${id}`] = {
          prev: undefined,
          new: pub,
        };
      }
    }

    // If there are no changes, return isValid with no changes
    if (Object.keys(changes).length === 0) {
      return {
        isValid: true,
        changes: {},
      };
    }

    // Return successful validation with changes
    return {
      isValid: true,
      changes,
    };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error ? error.message : "Unknown validation error",
    };
  }
}

/**
 * Type guard to check if a change is a feed change
 */
function isFeedChange(key: string, change: any): change is FeedChange {
  return key.startsWith("feed_");
}

/**
 * Type guard to check if a change is a publisher change
 */
function isPublisherChange(
  key: string,
  change: any,
): change is PublisherChange {
  return key.startsWith("publisher_");
}

/**
 * Type guard to check if a change is a shard change
 */
function isShardChange(key: string, change: any): change is ShardChange {
  return key === "shard";
}

/**
 * Generate the necessary instructions to apply configuration changes
 *
 * @param changes Configuration changes to apply
 * @param accounts Additional context needed for generating instructions
 * @returns Promise resolving to an array of TransactionInstructions
 */
export async function generateInstructions(
  changes: LazerConfigChanges,
  accounts: LazerInstructionAccounts,
  targetChainId: ChainName,
): Promise<TransactionInstruction[]> {
  // This function converts configuration changes into Lazer governance instructions
  // using the new governance payload functions that properly encode protobuf messages.
  const instructions: TransactionInstruction[] = [];
  const directives: pyth_lazer_transaction.IGovernanceDirective[] = [];

  // Process each change and create corresponding governance directives
  for (const [changeKey, change] of Object.entries(changes)) {
    if (isFeedChange(changeKey, change)) {
      const feedId = parseInt(changeKey.replace("feed_", ""));

      if (!change.prev && change.new) {
        // Adding a new feed
        const feedMetadata = change.new.metadata;

        const addFeedMessage = pyth_lazer_transaction.AddFeed.create({
          feedId: feedId,
          metadata: convertLazerFeedMetadataToMap(feedMetadata),
          permissionedPublishers: [],
        });

        directives.push({
          shardFilter: {
            allShards: {},
          },
          addFeed: addFeedMessage,
        });
      } else if (change.prev && change.new) {
        // Updating an existing feed
        const prevFeed = change.prev;
        const newFeed = change.new;

        // Check if metadata changed
        if (
          JSON.stringify(prevFeed.metadata) !== JSON.stringify(newFeed.metadata)
        ) {
          const updateFeedMessage = pyth_lazer_transaction.UpdateFeed.create({
            feedId: feedId,
            updateFeedMetadata: {
              name: "metadata",
              value: {
                map: convertLazerFeedMetadataToMap(newFeed.metadata),
              },
            },
          });

          directives.push({
            shardFilter: {
              allShards: {},
            },
            updateFeed: updateFeedMessage,
          });
        }

        // Check if pendingActivation changed
        if (prevFeed.pendingActivation !== newFeed.pendingActivation) {
          // If pendingActivation is being set or changed, create an activation instruction
          if (newFeed.pendingActivation) {
            const updateFeedMessage = pyth_lazer_transaction.UpdateFeed.create({
              feedId: feedId,
              activateFeed: {
                activationTimestamp: {
                  seconds: Math.floor(
                    new Date(newFeed.pendingActivation).getTime() / 1000,
                  ),
                  nanos: 0,
                },
              },
            });

            directives.push({
              shardFilter: {
                allShards: {},
              },
              updateFeed: updateFeedMessage,
            });
          } else {
            // Deactivate feed
            const updateFeedMessage = pyth_lazer_transaction.UpdateFeed.create({
              feedId: feedId,
              deactivateFeed: {
                deactivationTimestamp: {
                  seconds: Math.floor(Date.now() / 1000),
                  nanos: 0,
                },
              },
            });

            directives.push({
              shardFilter: {
                allShards: {},
              },
              updateFeed: updateFeedMessage,
            });
          }
        }
      } else if (change.prev && !change.new) {
        // Removing a feed
        const updateFeedMessage = pyth_lazer_transaction.UpdateFeed.create({
          feedId: feedId,
          removeFeed: {},
        });

        directives.push({
          shardFilter: {
            allShards: {},
          },
          updateFeed: updateFeedMessage,
        });
      }
    } else if (isPublisherChange(changeKey, change)) {
      const publisherId = parseInt(changeKey.replace("publisher_", ""));

      if (!change.prev && change.new) {
        // Adding a new publisher
        const newPublisher = change.new;

        const addPublisherMessage = pyth_lazer_transaction.AddPublisher.create({
          publisherId: publisherId,
          name: newPublisher.name,
          publicKeys: newPublisher.publicKeys.map((key) =>
            Buffer.from(key, "base64"),
          ),
          isActive: newPublisher.isActive,
        });

        directives.push({
          shardFilter: {
            allShards: {},
          },
          addPublisher: addPublisherMessage,
        });
      } else if (change.prev && change.new) {
        // Updating an existing publisher
        const prevPublisher = change.prev;
        const newPublisher = change.new;

        // Check if name changed
        if (prevPublisher.name !== newPublisher.name) {
          const updatePublisherMessage =
            pyth_lazer_transaction.UpdatePublisher.create({
              publisherId: publisherId,
              setPublisherName: {
                name: newPublisher.name,
              },
            });

          directives.push({
            shardFilter: {
              allShards: {},
            },
            updatePublisher: updatePublisherMessage,
          });
        }

        // Check if public keys changed
        if (
          JSON.stringify(prevPublisher.publicKeys) !==
          JSON.stringify(newPublisher.publicKeys)
        ) {
          const updatePublisherMessage =
            pyth_lazer_transaction.UpdatePublisher.create({
              publisherId: publisherId,
              setPublisherPublicKeys: {
                publicKeys: newPublisher.publicKeys.map((key) =>
                  Buffer.from(key, "base64"),
                ),
              },
            });

          directives.push({
            shardFilter: {
              allShards: {},
            },
            updatePublisher: updatePublisherMessage,
          });
        }

        // Check if active status changed
        if (prevPublisher.isActive !== newPublisher.isActive) {
          const updatePublisherMessage =
            pyth_lazer_transaction.UpdatePublisher.create({
              publisherId: publisherId,
              setPublisherActive: {
                isActive: newPublisher.isActive,
              },
            });

          directives.push({
            shardFilter: {
              allShards: {},
            },
            updatePublisher: updatePublisherMessage,
          });
        }
      } else if (change.prev && !change.new) {
        // Removing a publisher
        const updatePublisherMessage =
          pyth_lazer_transaction.UpdatePublisher.create({
            publisherId: publisherId,
            removePublisher: {},
          });

        directives.push({
          shardFilter: {
            allShards: {},
          },
          updatePublisher: updatePublisherMessage,
        });
      }
    } else if (isShardChange(changeKey, change)) {
      // Updating shard configuration
      if (change.new) {
        const newShard = change.new;
        const prevShard = change.prev;

        // Check if shard name changed
        if (!prevShard || prevShard.shardName !== newShard.shardName) {
          const setShardNameMessage =
            pyth_lazer_transaction.SetShardName.create({
              shardName: newShard.shardName,
            });

          directives.push({
            shardFilter: {
              allShards: {},
            },
            setShardName: setShardNameMessage,
          });
        }
      }
    }
  }

  // Create a single LazerExecute instruction with all directives if we have any
  if (directives.length > 0) {
    const lazerExecute = new LazerExecute(
      targetChainId,
      directives,
      undefined, // minExecutionTimestamp
      undefined, // maxExecutionTimestamp
      undefined, // governanceSequenceNo
    );

    const governanceBuffer = lazerExecute.encode();

    const instruction = new TransactionInstruction({
      keys: [
        {
          pubkey: accounts.fundingAccount,
          isSigner: true,
          isWritable: true,
        },
      ],
      programId: LAZER_PROGRAM_ID,
      data: governanceBuffer,
    });

    instructions.push(instruction);
  }

  return instructions;
}

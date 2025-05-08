import { ProgramAdapter } from "../program_adapter";
import {
  AccountType,
  PythCluster,
  getPythProgramKeyForCluster,
  parseBaseData,
  parseMappingData,
  parsePermissionData,
  parsePriceData,
  parseProductData,
  PermissionData,
  Product,
} from "@pythnetwork/client";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  findDetermisticAccountAddress,
  getMessageBufferAddressForPrice,
  getPythOracleMessageBufferCpiAuth,
  isMessageBufferAvailable,
  MESSAGE_BUFFER_BUFFER_SIZE,
  PRICE_FEED_OPS_KEY,
  getMaximumNumberOfPublishers,
  isPriceStoreInitialized,
  isPriceStorePublisherInitialized,
  createDetermisticPriceStoreInitializePublisherInstruction,
} from "../../index";

/**
 * Maximum sizes for instruction data to fit into transactions
 */
const MAX_SIZE_ADD_PRODUCT_INSTRUCTION_DATA = 369;
const MAX_SIZE_UPD_PRODUCT_INSTRUCTION_DATA = 403; // upd product has one account less

/**
 * Check if an instruction's data size is within limits
 *
 * @param instruction The instruction to check
 * @param maxSize Maximum allowed size
 * @param symbol Symbol being processed (for error reporting)
 */
function checkSizeOfProductInstruction(
  instruction: TransactionInstruction,
  maxSize: number,
  symbol: string,
) {
  const size = instruction.data.length;
  if (size > maxSize) {
    throw new Error(
      `A symbol metadata is too big to be sent in a transaction (${size} > ${maxSize} bytes). Please reduce the size of the symbol metadata for ${symbol}.`,
    );
  }
}

/**
 * Type for raw price configs
 */
export type PriceRawConfig = {
  next: PublicKey | null;
  address: PublicKey;
  expo: number;
  minPub: number;
  maxLatency: number;
  publishers: PublicKey[];
};

/**
 * Type for raw product configs
 */
export type ProductRawConfig = {
  address: PublicKey;
  priceAccounts: PriceRawConfig[];
  metadata: Product;
};

/**
 * Type for raw mapping configs
 */
export type MappingRawConfig = {
  address: PublicKey;
  next: PublicKey | null;
  products: ProductRawConfig[];
};

/**
 * Overall raw configuration type
 */
export type RawConfig = {
  mappingAccounts: MappingRawConfig[];
  permissionAccount?: PermissionData;
};

/**
 * Type for a set of Pyth Core symbols
 */
export type SymbolsSet = Set<string>;

/**
 * Adapter for the original Pyth Core oracle program
 */
export class PythCoreAdapter implements ProgramAdapter {
  readonly name = "Pyth Core";
  readonly description = "Original Pyth oracle program";
  readonly type = "PYTH_CORE";

  /**
   * Get the program address for the given cluster
   */
  getProgramAddress(cluster: PythCluster): PublicKey {
    return getPythProgramKeyForCluster(cluster);
  }

  /**
   * Check if the Pyth Core program is available on the specified cluster
   */
  isAvailableOnCluster(cluster: PythCluster): boolean {
    // Pyth Core is available on all clusters
    return true;
  }

  /**
   * Parse raw on-chain accounts into the Pyth Core configuration format
   */
  getConfigFromRawAccounts(accounts: any[], cluster: PythCluster): RawConfig {
    const priceRawConfigs: { [key: string]: PriceRawConfig } = {};
    const rawConfig: RawConfig = { mappingAccounts: [] };

    // Make a copy of the accounts array to modify
    const allPythAccounts = [...accounts];

    /// First pass, price accounts
    let i = 0;
    while (i < allPythAccounts.length) {
      const base = parseBaseData(allPythAccounts[i].account.data);
      switch (base?.type) {
        case AccountType.Price:
          const parsed = parsePriceData(allPythAccounts[i].account.data);
          priceRawConfigs[allPythAccounts[i].pubkey.toBase58()] = {
            next: parsed.nextPriceAccountKey,
            address: allPythAccounts[i].pubkey,
            publishers: parsed.priceComponents.map((x) => {
              return x.publisher!;
            }),
            expo: parsed.exponent,
            minPub: parsed.minPublishers,
            maxLatency: parsed.maxLatency,
          };
          allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1];
          allPythAccounts.pop();
          break;
        default:
          i += 1;
      }
    }

    /// Second pass, product accounts
    i = 0;
    const productRawConfigs: { [key: string]: ProductRawConfig } = {};
    while (i < allPythAccounts.length) {
      const base = parseBaseData(allPythAccounts[i].account.data);
      switch (base?.type) {
        case AccountType.Product:
          const parsed = parseProductData(allPythAccounts[i].account.data);
          if (parsed.priceAccountKey) {
            let priceAccountKey: string | undefined =
              parsed.priceAccountKey.toBase58();
            const priceAccounts = [];
            while (priceAccountKey) {
              const toAdd: PriceRawConfig = priceRawConfigs[priceAccountKey];
              priceAccounts.push(toAdd);
              delete priceRawConfigs[priceAccountKey];
              priceAccountKey = toAdd.next ? toAdd.next.toBase58() : undefined;
            }
            productRawConfigs[allPythAccounts[i].pubkey.toBase58()] = {
              priceAccounts,
              metadata: parsed.product,
              address: allPythAccounts[i].pubkey,
            };
          }
          allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1];
          allPythAccounts.pop();
          break;
        default:
          i += 1;
      }
    }

    /// Third pass, mapping accounts
    i = 0;
    while (i < allPythAccounts.length) {
      const base = parseBaseData(allPythAccounts[i].account.data);
      switch (base?.type) {
        case AccountType.Mapping:
          const parsed = parseMappingData(allPythAccounts[i].account.data);
          rawConfig.mappingAccounts.push({
            next: parsed.nextMappingAccount,
            address: allPythAccounts[i].pubkey,
            products: parsed.productAccountKeys
              .filter((key) => productRawConfigs[key.toBase58()])
              .map((key) => {
                const toAdd = productRawConfigs[key.toBase58()];
                delete productRawConfigs[key.toBase58()];
                return toAdd;
              }),
          });
          allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1];
          allPythAccounts.pop();
          break;
        case AccountType.Permission:
          rawConfig.permissionAccount = parsePermissionData(
            allPythAccounts[i].account.data,
          );
          allPythAccounts[i] = allPythAccounts[allPythAccounts.length - 1];
          allPythAccounts.pop();
          break;
        default:
          i += 1;
      }
    }

    return rawConfig;
  }

  /**
   * Format configuration for download as JSON
   */
  getDownloadableConfig(rawConfig: RawConfig): any {
    // Convert the raw config to a user-friendly format for download
    const symbolToData: any = {};

    if (rawConfig.mappingAccounts.length > 0) {
      rawConfig.mappingAccounts
        .sort(
          (mapping1, mapping2) =>
            mapping2.products.length - mapping1.products.length,
        )[0]
        .products.sort((product1, product2) =>
          product1.metadata.symbol.localeCompare(product2.metadata.symbol),
        )
        .map((product) => {
          symbolToData[product.metadata.symbol] = {
            address: product.address.toBase58(),
            metadata: {
              ...product.metadata,
            },
            priceAccounts: product.priceAccounts.map((p: PriceRawConfig) => {
              return {
                address: p.address.toBase58(),
                publishers: p.publishers.map((p) => p.toBase58()),
                expo: p.expo,
                minPub: p.minPub,
                maxLatency: p.maxLatency,
              };
            }),
          };
          // This field is immutable and should not be updated
          delete symbolToData[product.metadata.symbol].metadata.price_account;
        });
    }

    return this.sortData(symbolToData);
  }

  /**
   * Sort configuration data for consistent output
   */
  private sortData(data: any) {
    const sortedData: any = {};
    Object.keys(data)
      .sort()
      .forEach((key) => {
        const sortedInnerData: any = {};
        Object.keys(data[key])
          .sort()
          .forEach((innerKey) => {
            if (innerKey === "metadata") {
              sortedInnerData[innerKey] = this.sortObjectByKeys(
                data[key][innerKey],
              );
            } else if (innerKey === "priceAccounts") {
              // Sort price accounts by address
              sortedInnerData[innerKey] = data[key][innerKey].sort(
                (priceAccount1: any, priceAccount2: any) =>
                  priceAccount1.address.localeCompare(priceAccount2.address),
              );
              // Sort price accounts keys
              sortedInnerData[innerKey] = sortedInnerData[innerKey].map(
                (priceAccount: any) => {
                  const sortedPriceAccount: any = {};
                  Object.keys(priceAccount)
                    .sort()
                    .forEach((priceAccountKey) => {
                      if (priceAccountKey === "publishers") {
                        sortedPriceAccount[priceAccountKey] = priceAccount[
                          priceAccountKey
                        ].sort((pub1: string, pub2: string) =>
                          pub1.localeCompare(pub2),
                        );
                      } else {
                        sortedPriceAccount[priceAccountKey] =
                          priceAccount[priceAccountKey];
                      }
                    });
                  return sortedPriceAccount;
                },
              );
            } else {
              sortedInnerData[innerKey] = data[key][innerKey];
            }
          });
        sortedData[key] = sortedInnerData;
      });
    return sortedData;
  }

  /**
   * Sort object by keys
   */
  private sortObjectByKeys(obj: any) {
    const sortedObj: any = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sortedObj[key] = obj[key];
      });
    return sortedObj;
  }

  /**
   * Validate an uploaded configuration against the current configuration
   */
  validateUploadedConfig(
    existingConfig: any,
    uploadedConfig: any,
    cluster: PythCluster,
  ): {
    isValid: boolean;
    error?: string;
    changes?: any;
  } {
    try {
      // Validate that the uploaded data is valid JSON
      if (typeof uploadedConfig !== "object") {
        return { isValid: false, error: "Invalid JSON format" };
      }

      const existingSymbols = new Set(Object.keys(existingConfig));
      const changes: Record<string, any> = {};

      // Check for changes to existing symbols
      Object.keys(uploadedConfig).forEach((symbol) => {
        // Remove duplicate publishers
        if (
          uploadedConfig[symbol]?.priceAccounts?.[0]?.publishers &&
          Array.isArray(uploadedConfig[symbol].priceAccounts[0].publishers)
        ) {
          uploadedConfig[symbol].priceAccounts[0].publishers = [
            ...new Set(uploadedConfig[symbol].priceAccounts[0].publishers),
          ];
        }

        if (!existingSymbols.has(symbol)) {
          // If symbol is not in existing symbols, create new entry
          changes[symbol] = { new: {} };
          changes[symbol].new = { ...uploadedConfig[symbol] };
          changes[symbol].new.metadata = {
            symbol,
            ...changes[symbol].new.metadata,
          };
          // These fields are generated deterministically and should not be updated
          delete changes[symbol].new.address;
          if (changes[symbol].new.priceAccounts?.[0]) {
            delete changes[symbol].new.priceAccounts[0].address;
          }
        } else if (
          // If symbol is in existing symbols, check if data is different
          JSON.stringify(existingConfig[symbol]) !==
          JSON.stringify(uploadedConfig[symbol])
        ) {
          changes[symbol] = { prev: {}, new: {} };
          changes[symbol].prev = { ...existingConfig[symbol] };
          changes[symbol].new = { ...uploadedConfig[symbol] };
        }
      });

      // Check for symbols to remove (in existing but not in uploaded)
      Object.keys(existingConfig).forEach((symbol) => {
        if (!uploadedConfig[symbol]) {
          changes[symbol] = { prev: {} };
          changes[symbol].prev = { ...existingConfig[symbol] };
        }
      });

      // Validate that address field is not changed for existing symbols
      Object.keys(uploadedConfig).forEach((symbol) => {
        if (
          existingSymbols.has(symbol) &&
          uploadedConfig[symbol].address &&
          uploadedConfig[symbol].address !== existingConfig[symbol].address
        ) {
          return {
            isValid: false,
            error: `Address field for product cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
          };
        }
      });

      // Validate that priceAccounts address field is not changed
      Object.keys(uploadedConfig).forEach((symbol) => {
        if (
          existingSymbols.has(symbol) &&
          uploadedConfig[symbol].priceAccounts?.[0] &&
          existingConfig[symbol].priceAccounts?.[0] &&
          uploadedConfig[symbol].priceAccounts[0].address &&
          uploadedConfig[symbol].priceAccounts[0].address !==
            existingConfig[symbol].priceAccounts[0].address
        ) {
          return {
            isValid: false,
            error: `Address field for priceAccounts cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
          };
        }
      });

      // Check that no price account has more than the maximum number of publishers
      Object.keys(uploadedConfig).forEach((symbol) => {
        const maximumNumberOfPublishers = getMaximumNumberOfPublishers(cluster);
        if (
          uploadedConfig[symbol].priceAccounts?.[0]?.publishers &&
          uploadedConfig[symbol].priceAccounts[0].publishers.length >
            maximumNumberOfPublishers
        ) {
          return {
            isValid: false,
            error: `${symbol} has more than ${maximumNumberOfPublishers} publishers.`,
          };
        }
      });

      return {
        isValid: true,
        changes,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || "Failed to validate configuration",
      };
    }
  }

  /**
   * Generate instructions to apply configuration changes
   */
  async generateInstructions(
    changes: any,
    cluster: PythCluster,
    accounts: {
      fundingAccount: PublicKey;
      pythProgramClient: any;
      messageBufferClient?: any;
      connection?: any;
      rawConfig: RawConfig;
    },
  ): Promise<TransactionInstruction[]> {
    const instructions: TransactionInstruction[] = [];
    const publisherInPriceStoreInitializationsVerified: PublicKey[] = [];
    const {
      fundingAccount,
      pythProgramClient,
      messageBufferClient,
      connection,
      rawConfig,
    } = accounts;

    for (const symbol of Object.keys(changes)) {
      const initPublisherInPriceStore = async (publisherKey: PublicKey) => {
        // Ignore this step if Price Store is not initialized (or not deployed)
        if (!connection || !(await isPriceStoreInitialized(connection))) {
          return;
        }

        if (
          publisherInPriceStoreInitializationsVerified.every(
            (el) => !el.equals(publisherKey),
          )
        ) {
          if (
            !connection ||
            !(await isPriceStorePublisherInitialized(connection, publisherKey))
          ) {
            instructions.push(
              await createDetermisticPriceStoreInitializePublisherInstruction(
                fundingAccount,
                publisherKey,
              ),
            );
          }
          publisherInPriceStoreInitializationsVerified.push(publisherKey);
        }
      };

      const { prev, new: newChanges } = changes[symbol];

      // if prev is undefined, it means that the symbol is new
      if (!prev) {
        // deterministically generate product account key
        const productAccountKey: PublicKey = (
          await findDetermisticAccountAddress(
            AccountType.Product,
            symbol,
            cluster,
          )
        )[0];

        // create add product account instruction
        const instruction = await pythProgramClient.methods
          .addProduct({ ...newChanges.metadata })
          .accounts({
            fundingAccount,
            tailMappingAccount: rawConfig.mappingAccounts[0].address,
            productAccount: productAccountKey,
          })
          .instruction();

        checkSizeOfProductInstruction(
          instruction,
          MAX_SIZE_ADD_PRODUCT_INSTRUCTION_DATA,
          symbol,
        );

        instructions.push(instruction);

        // deterministically generate price account key
        const priceAccountKey: PublicKey = (
          await findDetermisticAccountAddress(
            AccountType.Price,
            symbol,
            cluster,
          )
        )[0];

        // create add price account instruction
        instructions.push(
          await pythProgramClient.methods
            .addPrice(newChanges.priceAccounts[0].expo, 1)
            .accounts({
              fundingAccount,
              productAccount: productAccountKey,
              priceAccount: priceAccountKey,
            })
            .instruction(),
        );

        if (isMessageBufferAvailable(cluster) && messageBufferClient) {
          // create create buffer instruction for the price account
          instructions.push(
            await messageBufferClient.methods
              .createBuffer(
                getPythOracleMessageBufferCpiAuth(cluster),
                priceAccountKey,
                MESSAGE_BUFFER_BUFFER_SIZE,
              )
              .accounts({
                admin: fundingAccount,
                payer: PRICE_FEED_OPS_KEY,
              })
              .remainingAccounts([
                {
                  pubkey: getMessageBufferAddressForPrice(
                    cluster,
                    priceAccountKey,
                  ),
                  isSigner: false,
                  isWritable: true,
                },
              ])
              .instruction(),
          );
        }

        // create add publisher instruction if there are any publishers
        for (const publisherKey of newChanges.priceAccounts[0].publishers) {
          const publisherPubKey = new PublicKey(publisherKey);
          instructions.push(
            await pythProgramClient.methods
              .addPublisher(publisherPubKey)
              .accounts({
                fundingAccount,
                priceAccount: priceAccountKey,
              })
              .instruction(),
          );
          await initPublisherInPriceStore(publisherPubKey);
        }

        // create set min publisher instruction if there are any publishers
        if (newChanges.priceAccounts[0].minPub !== undefined) {
          instructions.push(
            await pythProgramClient.methods
              .setMinPub(newChanges.priceAccounts[0].minPub, [0, 0, 0])
              .accounts({
                priceAccount: priceAccountKey,
                fundingAccount,
              })
              .instruction(),
          );
        }

        // If maxLatency is set and is not 0, create update maxLatency instruction
        if (
          newChanges.priceAccounts[0].maxLatency !== undefined &&
          newChanges.priceAccounts[0].maxLatency !== 0
        ) {
          instructions.push(
            await pythProgramClient.methods
              .setMaxLatency(newChanges.priceAccounts[0].maxLatency, [0, 0, 0])
              .accounts({
                priceAccount: priceAccountKey,
                fundingAccount,
              })
              .instruction(),
          );
        }
      } else if (!newChanges) {
        const priceAccount = new PublicKey(prev.priceAccounts[0].address);

        // if new is undefined, it means that the symbol is deleted
        // create delete price account instruction
        instructions.push(
          await pythProgramClient.methods
            .delPrice()
            .accounts({
              fundingAccount,
              productAccount: new PublicKey(prev.address),
              priceAccount,
            })
            .instruction(),
        );

        // create delete product account instruction
        instructions.push(
          await pythProgramClient.methods
            .delProduct()
            .accounts({
              fundingAccount,
              mappingAccount: rawConfig.mappingAccounts[0].address,
              productAccount: new PublicKey(prev.address),
            })
            .instruction(),
        );

        if (isMessageBufferAvailable(cluster) && messageBufferClient) {
          // create delete buffer instruction for the price buffer
          instructions.push(
            await messageBufferClient.methods
              .deleteBuffer(
                getPythOracleMessageBufferCpiAuth(cluster),
                priceAccount,
              )
              .accounts({
                admin: fundingAccount,
                payer: PRICE_FEED_OPS_KEY,
                messageBuffer: getMessageBufferAddressForPrice(
                  cluster,
                  priceAccount,
                ),
              })
              .instruction(),
          );
        }
      } else {
        // check if metadata has changed
        if (
          JSON.stringify(prev.metadata) !== JSON.stringify(newChanges.metadata)
        ) {
          const instruction = await pythProgramClient.methods
            .updProduct({ symbol, ...newChanges.metadata }) // If there's a symbol in newChanges.metadata, it will overwrite the current symbol
            .accounts({
              fundingAccount,
              productAccount: new PublicKey(prev.address),
            })
            .instruction();

          checkSizeOfProductInstruction(
            instruction,
            MAX_SIZE_UPD_PRODUCT_INSTRUCTION_DATA,
            symbol,
          );

          instructions.push(instruction);
        }

        if (
          JSON.stringify(prev.priceAccounts[0].expo) !==
          JSON.stringify(newChanges.priceAccounts[0].expo)
        ) {
          // create update exponent instruction
          instructions.push(
            await pythProgramClient.methods
              .setExponent(newChanges.priceAccounts[0].expo, 1)
              .accounts({
                fundingAccount,
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction(),
          );
        }

        // check if maxLatency has changed
        if (
          prev.priceAccounts[0].maxLatency !==
          newChanges.priceAccounts[0].maxLatency
        ) {
          // create update product account instruction
          instructions.push(
            await pythProgramClient.methods
              .setMaxLatency(newChanges.priceAccounts[0].maxLatency, [0, 0, 0])
              .accounts({
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
                fundingAccount,
              })
              .instruction(),
          );
        }

        // check if publishers have changed
        const publisherKeysToAdd =
          newChanges.priceAccounts[0].publishers.filter(
            (newPublisher: string) =>
              !prev.priceAccounts[0].publishers.includes(newPublisher),
          );

        // check if there are any publishers to remove by comparing prev and new
        const publisherKeysToRemove = prev.priceAccounts[0].publishers.filter(
          (prevPublisher: string) =>
            !newChanges.priceAccounts[0].publishers.includes(prevPublisher),
        );

        // add instructions to remove publishers
        for (const publisherKey of publisherKeysToRemove) {
          instructions.push(
            await pythProgramClient.methods
              .delPublisher(new PublicKey(publisherKey))
              .accounts({
                fundingAccount,
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction(),
          );
        }

        // add instructions to add new publishers
        for (const publisherKey of publisherKeysToAdd) {
          const publisherPubKey = new PublicKey(publisherKey);
          instructions.push(
            await pythProgramClient.methods
              .addPublisher(publisherPubKey)
              .accounts({
                fundingAccount,
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
              })
              .instruction(),
          );
          await initPublisherInPriceStore(publisherPubKey);
        }

        // check if minPub has changed
        if (
          prev.priceAccounts[0].minPub !== newChanges.priceAccounts[0].minPub
        ) {
          // create update product account instruction
          instructions.push(
            await pythProgramClient.methods
              .setMinPub(newChanges.priceAccounts[0].minPub, [0, 0, 0])
              .accounts({
                priceAccount: new PublicKey(prev.priceAccounts[0].address),
                fundingAccount,
              })
              .instruction(),
          );
        }
      }
    }

    return instructions;
  }
}

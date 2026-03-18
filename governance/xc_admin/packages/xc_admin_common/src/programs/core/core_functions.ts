import type { Program } from "@coral-xyz/anchor";
import type { Product, PythCluster } from "@pythnetwork/client";
import {
  AccountType,
  parseBaseData,
  parseMappingData,
  parsePermissionData,
  parsePriceData,
  parseProductData,
} from "@pythnetwork/client";
import type { PythOracle } from "@pythnetwork/client/lib/anchor";
import type {
  AccountInfo,
  Connection,
  TransactionInstruction,
} from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import type { MessageBuffer } from "message_buffer/idl/message_buffer";
import {
  createDetermisticPriceStoreInitializePublisherInstruction,
  findDetermisticAccountAddress,
  getMaximumNumberOfPublishers,
  getMessageBufferAddressForPrice,
  getPythOracleMessageBufferCpiAuth,
  isMessageBufferAvailable,
  isPriceStoreInitialized,
  isPriceStorePublisherInitialized,
  MESSAGE_BUFFER_BUFFER_SIZE,
  PRICE_FEED_OPS_KEY,
} from "../../index";
import type {
  DownloadableConfig,
  DownloadablePriceAccount,
  DownloadableProduct,
  PriceRawConfig,
  RawConfig,
  ValidationResult,
} from "../types";

/**
 * Maximum sizes for instruction data to fit into transactions
 */
const MAX_SIZE_ADD_PRODUCT_INSTRUCTION_DATA = 369;
const MAX_SIZE_UPD_PRODUCT_INSTRUCTION_DATA = 403; // upd product has one account less

/**
 * Type for a set of Pyth Core symbols
 */
export type SymbolsSet = Set<string>;

export type CoreConfigParams = {
  accounts: Array<{ pubkey: PublicKey; account: AccountInfo<Buffer> }>;
  cluster: PythCluster;
};

/**
 * Core program instruction accounts needed for generateInstructions
 */
export type CoreInstructionAccounts = {
  fundingAccount: PublicKey;
  pythProgramClient: Program<PythOracle>;
  messageBufferClient?: Program<MessageBuffer>;
  connection?: Connection;
  rawConfig: RawConfig;
};

/**
 * Check if an instruction's data size is within limits
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
 * Sort object by keys
 */
const sortObjectByKeys = <U>(obj: Record<string, U>): [string, U][] =>
  Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));

/**
 * Helper function to transform object values
 */
const mapValues = <T, U>(
  obj: Record<string, T>,
  fn: (value: T) => U,
): Record<string, U> =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [key, fn(value)]),
  );

/**
 * Sort configuration data for consistent output
 */
function sortData(data: DownloadableConfig): DownloadableConfig {
  return mapValues(data, (productData: DownloadableProduct) => ({
    address: productData.address,
    metadata: Object.fromEntries(
      sortObjectByKeys(productData.metadata),
    ) as Omit<Product, "price_account">,
    priceAccounts: [...productData.priceAccounts]
      .sort((a: DownloadablePriceAccount, b: DownloadablePriceAccount) =>
        a.address.localeCompare(b.address),
      )
      .map((priceAccount: DownloadablePriceAccount) => ({
        address: priceAccount.address,
        expo: priceAccount.expo,
        maxLatency: priceAccount.maxLatency,
        minPub: priceAccount.minPub,
        publishers: [...priceAccount.publishers].sort((a: string, b: string) =>
          a.localeCompare(b),
        ),
      })),
  }));
}

/**
 * Parse raw on-chain accounts into the Pyth Core configuration format
 */
export function getConfig(params: CoreConfigParams): RawConfig {
  const accounts = params.accounts;

  // Create a map of parsed base data for each account to avoid repeated parsing
  const parsedBaseDataMap = new Map(
    accounts.map((account) => {
      const baseData = parseBaseData(account.account.data);
      return [account.pubkey.toBase58(), baseData];
    }),
  );

  // First pass: Extract price accounts
  const priceRawConfigs = Object.fromEntries(
    accounts
      .filter(
        ({ pubkey }) =>
          parsedBaseDataMap.get(pubkey.toBase58())?.type === AccountType.Price,
      )
      .map(({ account, pubkey }) => {
        const parsed = parsePriceData(account.data);
        return [
          pubkey.toBase58(),
          {
            address: pubkey,
            expo: parsed.exponent,
            maxLatency: parsed.maxLatency,
            minPub: parsed.minPublishers,
            next: parsed.nextPriceAccountKey,
            publishers: parsed.priceComponents
              .filter((x) => x.publisher !== null && x.publisher !== undefined)
              .map((x) => x.publisher),
          },
        ];
      }),
  );

  // Second pass: Extract product accounts and link to price accounts
  const productRawConfigs = Object.fromEntries(
    accounts
      .filter(
        ({ pubkey }) =>
          parsedBaseDataMap.get(pubkey.toBase58())?.type ===
          AccountType.Product,
      )
      .map(({ account, pubkey }) => {
        const parsed = parseProductData(account.data);
        const priceAccounts: PriceRawConfig[] = [];

        // Follow the linked list of price accounts
        if (parsed.priceAccountKey) {
          let priceAccountKey: string | undefined =
            parsed.priceAccountKey.toBase58();
          const processedPriceKeys = new Set<string>();

          while (
            priceAccountKey &&
            !processedPriceKeys.has(priceAccountKey) &&
            priceRawConfigs[priceAccountKey]
          ) {
            processedPriceKeys.add(priceAccountKey);
            const priceConfig: PriceRawConfig =
              // biome-ignore lint/style/noNonNullAssertion: legacy non-null assertion
              priceRawConfigs[priceAccountKey]!;
            priceAccounts.push(priceConfig);
            priceAccountKey = priceConfig.next
              ? priceConfig.next.toBase58()
              : undefined;
          }
        }

        return [
          pubkey.toBase58(),
          {
            address: pubkey,
            metadata: parsed.product,
            priceAccounts,
          },
        ];
      }),
  );

  // Third pass: Extract mapping accounts and permission data
  const processedProducts = new Map<string, boolean>();
  const mappingAccounts = accounts
    .filter(
      (account) =>
        parsedBaseDataMap.get(account.pubkey.toBase58())?.type ===
        AccountType.Mapping,
    )
    .map((account) => {
      const parsed = parseMappingData(account.account.data);
      return {
        address: account.pubkey,
        next: parsed.nextMappingAccount,
        products: parsed.productAccountKeys
          .filter((key) => {
            const keyStr = key.toBase58();
            const productConfig = productRawConfigs[keyStr];
            // Only include products that exist, have price accounts, and haven't been processed yet
            return (
              productConfig !== undefined &&
              productConfig.priceAccounts.length > 0 &&
              !processedProducts.has(keyStr)
            );
          })
          .map((key) => {
            const keyStr = key.toBase58();
            const productConfig = productRawConfigs[keyStr];
            if (!productConfig) {
              throw new Error(`Product config not found for key: ${keyStr}`);
            }
            // Mark this product as processed
            processedProducts.set(keyStr, true);
            return productConfig;
          }),
      };
    });

  // Find permission account if it exists
  const permissionAccount = accounts.find(
    (account) =>
      parsedBaseDataMap.get(account.pubkey.toBase58())?.type ===
      AccountType.Permission,
  );

  return {
    mappingAccounts,
    ...(permissionAccount && {
      permissionAccount: parsePermissionData(permissionAccount.account.data),
    }),
  } as RawConfig;
}

/**
 * Format configuration for download as JSON
 */
export function getDownloadableConfig(
  rawConfig: RawConfig,
): DownloadableConfig {
  // Convert the raw config to a user-friendly format for download
  if (rawConfig.mappingAccounts.length > 0) {
    const largestMapping = rawConfig.mappingAccounts.sort(
      (mapping1, mapping2) =>
        mapping2.products.length - mapping1.products.length,
    )[0];

    if (!largestMapping) {
      return {};
    }

    const symbolToData = Object.fromEntries(
      largestMapping.products
        .sort((product1, product2) => {
          const symbol1 = product1.metadata.symbol ?? "";
          const symbol2 = product2.metadata.symbol ?? "";
          return symbol1.localeCompare(symbol2);
        })
        .map((product) => {
          const { price_account, ...metadataWithoutPriceAccount } =
            product.metadata;

          return [
            product.metadata.symbol,
            {
              address: product.address.toBase58(),
              metadata: metadataWithoutPriceAccount,
              priceAccounts: product.priceAccounts.map(
                (priceAccount: PriceRawConfig) => {
                  return {
                    address: priceAccount.address.toBase58(),
                    expo: priceAccount.expo,
                    maxLatency: priceAccount.maxLatency,
                    minPub: priceAccount.minPub,
                    publishers: priceAccount.publishers.map((publisher) =>
                      publisher.toBase58(),
                    ),
                  };
                },
              ),
            },
          ];
        }),
    );

    return sortData(symbolToData);
  }

  return {};
}

/**
 * Validate an uploaded configuration against the current configuration
 */
export function validateUploadedConfig(
  existingConfig: DownloadableConfig,
  uploadedConfig: DownloadableConfig,
  cluster: PythCluster,
): ValidationResult {
  try {
    const existingSymbols = new Set(Object.keys(existingConfig));
    const changes: Record<
      string,
      {
        prev?: Partial<DownloadableProduct> | undefined;
        new?: Partial<DownloadableProduct> | undefined;
      }
    > = {};

    // Create a deep copy of uploadedConfigTyped with deduplicated publishers
    const processedConfig = Object.fromEntries(
      Object.entries(uploadedConfig).map(([symbol, product]) => {
        if (
          product?.priceAccounts?.[0]?.publishers &&
          Array.isArray(product.priceAccounts[0].publishers)
        ) {
          // Create a deep copy with deduplicated publishers
          return [
            symbol,
            {
              ...product,
              priceAccounts: product.priceAccounts.map((priceAccount) => ({
                ...priceAccount,
                publishers: [...new Set(priceAccount.publishers)],
              })),
            },
          ];
        }
        return [symbol, product];
      }),
    );

    // Check for changes to existing symbols
    for (const symbol of Object.keys(processedConfig)) {
      if (!existingSymbols.has(symbol)) {
        // If symbol is not in existing symbols, create new entry
        const newProduct = { ...processedConfig[symbol] };

        // Add required metadata with symbol
        if (newProduct.metadata) {
          newProduct.metadata = {
            symbol,
            ...newProduct.metadata,
          };
        }

        // These fields are generated deterministically and should not be updated
        if (newProduct.address) {
          const { address, ...restProduct } = newProduct;
          changes[symbol] = { new: restProduct };
        } else {
          changes[symbol] = { new: newProduct };
        }

        // Remove address from price accounts if present
        if (changes[symbol].new?.priceAccounts?.[0]?.address) {
          const newChanges = changes[symbol].new;

          if (newChanges?.priceAccounts?.[0]) {
            const priceAccount = newChanges.priceAccounts[0];
            const { address, ...restPriceAccount } = priceAccount;

            newChanges.priceAccounts[0] = {
              ...restPriceAccount,
              address: "", // Placeholder to satisfy type requirements, will be overwritten when created
            };
          }
        }
      } else if (
        // If symbol is in existing symbols, check if data is different
        JSON.stringify(existingConfig[symbol]) !==
        JSON.stringify(processedConfig[symbol])
      ) {
        changes[symbol] = {
          new: processedConfig[symbol],
          prev: existingConfig[symbol],
        };
      }
    }

    // Check for symbols to remove (in existing but not in uploaded)
    for (const symbol of Object.keys(existingConfig)) {
      if (!processedConfig[symbol]) {
        changes[symbol] = {
          prev: existingConfig[symbol],
        };
      }
    }

    // Validate that address field is not changed for existing symbols
    for (const symbol of Object.keys(processedConfig)) {
      if (
        existingSymbols.has(symbol) &&
        processedConfig[symbol]?.address &&
        processedConfig[symbol]?.address !== existingConfig[symbol]?.address
      ) {
        return {
          error: `Address field for product cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
          isValid: false,
        };
      }
    }

    // Validate that priceAccounts address field is not changed
    for (const symbol of Object.keys(processedConfig)) {
      if (
        existingSymbols.has(symbol) &&
        processedConfig[symbol]?.priceAccounts?.[0] &&
        existingConfig[symbol]?.priceAccounts?.[0] &&
        processedConfig[symbol].priceAccounts[0].address &&
        processedConfig[symbol].priceAccounts[0].address !==
          existingConfig[symbol].priceAccounts[0].address
      ) {
        return {
          error: `Address field for priceAccounts cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
          isValid: false,
        };
      }
    }

    // Check that no price account has more than the maximum number of publishers
    for (const symbol of Object.keys(processedConfig)) {
      const maximumNumberOfPublishers = getMaximumNumberOfPublishers(cluster);
      if (
        processedConfig[symbol]?.priceAccounts?.[0]?.publishers &&
        processedConfig[symbol].priceAccounts[0].publishers.length >
          maximumNumberOfPublishers
      ) {
        return {
          error: `${symbol} has more than ${maximumNumberOfPublishers} publishers.`,
          isValid: false,
        };
      }
    }

    return {
      changes,
      isValid: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Failed to validate configuration",
      isValid: false,
    };
  }
}

/**
 * Helper function to initialize a publisher in the price store if needed
 */
async function initializePublisherInPriceStore(
  publisherKey: PublicKey,
  connection: Connection | undefined,
  fundingAccount: PublicKey,
  verifiedPublishers: PublicKey[],
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];

  if (!connection || verifiedPublishers.some((el) => el.equals(publisherKey))) {
    return instructions;
  }

  if (
    (await isPriceStoreInitialized(connection)) &&
    !(await isPriceStorePublisherInitialized(connection, publisherKey))
  ) {
    instructions.push(
      await createDetermisticPriceStoreInitializePublisherInstruction(
        fundingAccount,
        publisherKey,
      ),
    );
    verifiedPublishers.push(publisherKey);
  }

  return instructions;
}

/**
 * Generate instructions for adding a new product and price account
 */
async function generateAddInstructions(
  symbol: string,
  newChanges: Partial<DownloadableProduct>,
  cluster: PythCluster,
  accounts: CoreInstructionAccounts,
  verifiedPublishers: PublicKey[],
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];
  const {
    fundingAccount,
    pythProgramClient,
    messageBufferClient,
    connection,
    rawConfig,
  } = accounts;

  // Generate product account
  const [productAccountKey] = await findDetermisticAccountAddress(
    AccountType.Product,
    symbol,
    cluster,
  );

  if (newChanges.metadata) {
    const tailMappingAccount = rawConfig.mappingAccounts[0]?.address;
    if (!tailMappingAccount) {
      throw new Error(
        `No mapping account found in rawConfig for adding product ${symbol}`,
      );
    }

    const instruction = await pythProgramClient.methods
      .addProduct({ ...newChanges.metadata })
      .accounts({
        fundingAccount,
        productAccount: productAccountKey,
        tailMappingAccount,
      })
      .instruction();

    checkSizeOfProductInstruction(
      instruction,
      MAX_SIZE_ADD_PRODUCT_INSTRUCTION_DATA,
      symbol,
    );
    instructions.push(instruction);
  }

  // Generate price account
  if (newChanges.priceAccounts?.[0]) {
    const [priceAccountKey] = await findDetermisticAccountAddress(
      AccountType.Price,
      symbol,
      cluster,
    );

    instructions.push(
      await pythProgramClient.methods
        .addPrice(newChanges.priceAccounts[0].expo, 1)
        .accounts({
          fundingAccount,
          priceAccount: priceAccountKey,
          productAccount: productAccountKey,
        })
        .instruction(),
    );

    // Create message buffer if available
    if (isMessageBufferAvailable(cluster) && messageBufferClient) {
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
              isSigner: false,
              isWritable: true,
              pubkey: getMessageBufferAddressForPrice(cluster, priceAccountKey),
            },
          ])
          .instruction(),
      );
    }

    // Add publishers
    if (newChanges.priceAccounts[0].publishers) {
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
        instructions.push(
          ...(await initializePublisherInPriceStore(
            publisherPubKey,
            connection,
            fundingAccount,
            verifiedPublishers,
          )),
        );
      }
    }

    // Set min publishers if specified
    if (newChanges.priceAccounts[0].minPub !== undefined) {
      instructions.push(
        await pythProgramClient.methods
          .setMinPub(newChanges.priceAccounts[0].minPub, [0, 0, 0])
          .accounts({
            fundingAccount,
            priceAccount: priceAccountKey,
          })
          .instruction(),
      );
    }

    // Set max latency if specified and non-zero
    if (
      newChanges.priceAccounts[0].maxLatency !== undefined &&
      newChanges.priceAccounts[0].maxLatency !== 0
    ) {
      instructions.push(
        await pythProgramClient.methods
          .setMaxLatency(newChanges.priceAccounts[0].maxLatency, [0, 0, 0])
          .accounts({
            fundingAccount,
            priceAccount: priceAccountKey,
          })
          .instruction(),
      );
    }
  }

  return instructions;
}

/**
 * Generate instructions for deleting an existing product and price account
 */
async function generateDeleteInstructions(
  prev: Partial<DownloadableProduct>,
  cluster: PythCluster,
  accounts: CoreInstructionAccounts,
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];
  const { fundingAccount, pythProgramClient, messageBufferClient } = accounts;

  if (prev.priceAccounts?.[0]?.address) {
    const priceAccount = new PublicKey(prev.priceAccounts[0].address);

    // Delete price account
    instructions.push(
      await pythProgramClient.methods
        .delPrice()
        .accounts({
          fundingAccount,
          priceAccount,
          productAccount: new PublicKey(prev.address || ""),
        })
        .instruction(),
    );

    // Delete product account
    const mappingAccount = accounts.rawConfig.mappingAccounts[0]?.address;
    if (!mappingAccount) {
      throw new Error(
        "No mapping account found in rawConfig for deleting product",
      );
    }

    instructions.push(
      await pythProgramClient.methods
        .delProduct()
        .accounts({
          fundingAccount,
          mappingAccount,
          productAccount: new PublicKey(prev.address || ""),
        })
        .instruction(),
    );

    // Delete message buffer if available
    if (isMessageBufferAvailable(cluster) && messageBufferClient) {
      instructions.push(
        await messageBufferClient.methods
          .deleteBuffer(
            getPythOracleMessageBufferCpiAuth(cluster),
            priceAccount,
          )
          .accounts({
            admin: fundingAccount,
            messageBuffer: getMessageBufferAddressForPrice(
              cluster,
              priceAccount,
            ),
            payer: PRICE_FEED_OPS_KEY,
          })
          .instruction(),
      );
    }
  }

  return instructions;
}

/**
 * Generate instructions for updating an existing product and price account
 */
async function generateUpdateInstructions(
  symbol: string,
  prev: Partial<DownloadableProduct>,
  newChanges: Partial<DownloadableProduct>,
  accounts: CoreInstructionAccounts,
  verifiedPublishers: PublicKey[],
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];
  const { fundingAccount, pythProgramClient, connection } = accounts;

  // Update product metadata if changed
  if (
    prev.metadata &&
    newChanges.metadata &&
    JSON.stringify(prev.metadata) !== JSON.stringify(newChanges.metadata)
  ) {
    const instruction = await pythProgramClient.methods
      .updProduct({ symbol, ...newChanges.metadata })
      .accounts({
        fundingAccount,
        productAccount: new PublicKey(prev.address || ""),
      })
      .instruction();

    checkSizeOfProductInstruction(
      instruction,
      MAX_SIZE_UPD_PRODUCT_INSTRUCTION_DATA,
      symbol,
    );
    instructions.push(instruction);
  }

  const prevPrice = prev.priceAccounts?.[0];
  const newPrice = newChanges.priceAccounts?.[0];

  if (prevPrice && newPrice) {
    // Update exponent if changed
    if (prevPrice.expo !== newPrice.expo) {
      instructions.push(
        await pythProgramClient.methods
          .setExponent(newPrice.expo, 1)
          .accounts({
            fundingAccount,
            priceAccount: new PublicKey(prevPrice.address || ""),
          })
          .instruction(),
      );
    }

    // Update max latency if changed
    if (prevPrice.maxLatency !== newPrice.maxLatency) {
      instructions.push(
        await pythProgramClient.methods
          .setMaxLatency(newPrice.maxLatency, [0, 0, 0])
          .accounts({
            fundingAccount,
            priceAccount: new PublicKey(prevPrice.address || ""),
          })
          .instruction(),
      );
    }

    // Update publishers if changed
    if (prevPrice.publishers && newPrice.publishers) {
      const publishersToAdd = newPrice.publishers.filter(
        (newPub) => !prevPrice.publishers?.includes(newPub),
      );
      const publishersToRemove = prevPrice.publishers.filter(
        (prevPub) => !newPrice.publishers?.includes(prevPub),
      );

      // Remove publishers
      for (const pubKey of publishersToRemove) {
        instructions.push(
          await pythProgramClient.methods
            .delPublisher(new PublicKey(pubKey))
            .accounts({
              fundingAccount,
              priceAccount: new PublicKey(prevPrice.address || ""),
            })
            .instruction(),
        );
      }

      // Add publishers
      for (const pubKey of publishersToAdd) {
        const publisherPubKey = new PublicKey(pubKey);
        instructions.push(
          await pythProgramClient.methods
            .addPublisher(publisherPubKey)
            .accounts({
              fundingAccount,
              priceAccount: new PublicKey(prevPrice.address || ""),
            })
            .instruction(),
        );
        instructions.push(
          ...(await initializePublisherInPriceStore(
            publisherPubKey,
            connection,
            fundingAccount,
            verifiedPublishers,
          )),
        );
      }
    }

    // Update min publishers if changed
    if (prevPrice.minPub !== newPrice.minPub) {
      instructions.push(
        await pythProgramClient.methods
          .setMinPub(newPrice.minPub, [0, 0, 0])
          .accounts({
            fundingAccount,
            priceAccount: new PublicKey(prevPrice.address || ""),
          })
          .instruction(),
      );
    }
  }

  return instructions;
}

/**
 * Generate instructions to apply configuration changes
 */
export async function generateInstructions(
  changes: Record<
    string,
    {
      prev?: Partial<DownloadableProduct>;
      new?: Partial<DownloadableProduct>;
    }
  >,
  cluster: PythCluster,
  accounts: CoreInstructionAccounts,
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];
  const verifiedPublishers: PublicKey[] = [];

  for (const symbol of Object.keys(changes)) {
    const { prev, new: newChanges } = changes[symbol] ?? {};

    if (!prev && newChanges) {
      // Add new product/price
      instructions.push(
        ...(await generateAddInstructions(
          symbol,
          newChanges,
          cluster,
          accounts,
          verifiedPublishers,
        )),
      );
    } else if (prev && !newChanges) {
      // Delete existing product/price
      instructions.push(
        ...(await generateDeleteInstructions(prev, cluster, accounts)),
      );
    } else if (prev && newChanges) {
      // Update existing product/price
      instructions.push(
        ...(await generateUpdateInstructions(
          symbol,
          prev,
          newChanges,
          accounts,
          verifiedPublishers,
        )),
      );
    }
  }

  return instructions;
}

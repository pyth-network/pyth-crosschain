import {
  PublicKey,
  TransactionInstruction,
  AccountInfo,
  Connection,
} from "@solana/web3.js";
import {
  AccountType,
  PythCluster,
  getPythProgramKeyForCluster,
  parseBaseData,
  parseMappingData,
  parsePermissionData,
  parsePriceData,
  parseProductData,
  Product,
} from "@pythnetwork/client";
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
import {
  DownloadableConfig,
  DownloadablePriceAccount,
  DownloadableProduct,
  PriceRawConfig,
  RawConfig,
  ValidationResult,
  ProgramType,
} from "../types";
import { Program } from "@coral-xyz/anchor";
import { PythOracle } from "@pythnetwork/client/lib/anchor";
import { MessageBuffer } from "message_buffer/idl/message_buffer";

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
export interface CoreInstructionAccounts {
  fundingAccount: PublicKey;
  pythProgramClient: Program<PythOracle>;
  messageBufferClient?: Program<MessageBuffer>;
  connection?: Connection;
  rawConfig: RawConfig;
}

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
const sortObjectByKeys = <U>(obj: Record<string, U>): Array<[string, U]> =>
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
        minPub: priceAccount.minPub,
        maxLatency: priceAccount.maxLatency,
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
            next: parsed.nextPriceAccountKey,
            address: pubkey,
            publishers: parsed.priceComponents
              .filter((x) => x.publisher !== null && x.publisher !== undefined)
              .map((x) => x.publisher),
            expo: parsed.exponent,
            minPub: parsed.minPublishers,
            maxLatency: parsed.maxLatency,
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
              priceRawConfigs[priceAccountKey];
            priceAccounts.push(priceConfig);
            priceAccountKey = priceConfig.next
              ? priceConfig.next.toBase58()
              : undefined;
          }
        }

        return [
          pubkey.toBase58(),
          {
            priceAccounts,
            metadata: parsed.product,
            address: pubkey,
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
        next: parsed.nextMappingAccount,
        address: account.pubkey,
        products: parsed.productAccountKeys
          .filter((key) => {
            const keyStr = key.toBase58();
            // Only include products that exist, have price accounts, and haven't been processed yet
            return (
              productRawConfigs[keyStr] &&
              productRawConfigs[keyStr].priceAccounts.length > 0 &&
              !processedProducts.has(keyStr)
            );
          })
          .map((key) => {
            const keyStr = key.toBase58();
            const product = productRawConfigs[keyStr];
            // Mark this product as processed
            processedProducts.set(keyStr, true);
            return product;
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
  };
}

/**
 * Format configuration for download as JSON
 */
export function getDownloadableConfig(
  rawConfig: RawConfig,
): DownloadableConfig {
  // Convert the raw config to a user-friendly format for download
  if (rawConfig.mappingAccounts.length > 0) {
    const symbolToData = Object.fromEntries(
      rawConfig.mappingAccounts
        .sort(
          (mapping1, mapping2) =>
            mapping2.products.length - mapping1.products.length,
        )[0]
        .products.sort((product1, product2) =>
          product1.metadata.symbol.localeCompare(product2.metadata.symbol),
        )
        .map((product) => {
          const { price_account, ...metadataWithoutPriceAccount } =
            product.metadata;

          return [
            product.metadata.symbol,
            {
              address: product.address.toBase58(),
              metadata: metadataWithoutPriceAccount,
              priceAccounts: product.priceAccounts.map((p: PriceRawConfig) => {
                return {
                  address: p.address.toBase58(),
                  publishers: p.publishers.map((p) => p.toBase58()),
                  expo: p.expo,
                  minPub: p.minPub,
                  maxLatency: p.maxLatency,
                };
              }),
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
        prev?: Partial<DownloadableProduct>;
        new?: Partial<DownloadableProduct>;
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

          if (
            newChanges &&
            newChanges.priceAccounts &&
            newChanges.priceAccounts[0]
          ) {
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
          prev: existingConfig[symbol],
          new: processedConfig[symbol],
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
        processedConfig[symbol].address &&
        processedConfig[symbol].address !== existingConfig[symbol].address
      ) {
        return {
          isValid: false,
          error: `Address field for product cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
        };
      }
    }

    // Validate that priceAccounts address field is not changed
    for (const symbol of Object.keys(processedConfig)) {
      if (
        existingSymbols.has(symbol) &&
        processedConfig[symbol].priceAccounts?.[0] &&
        existingConfig[symbol].priceAccounts?.[0] &&
        processedConfig[symbol].priceAccounts[0].address &&
        processedConfig[symbol].priceAccounts[0].address !==
          existingConfig[symbol].priceAccounts[0].address
      ) {
        return {
          isValid: false,
          error: `Address field for priceAccounts cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
        };
      }
    }

    // Check that no price account has more than the maximum number of publishers
    for (const symbol of Object.keys(processedConfig)) {
      const maximumNumberOfPublishers = getMaximumNumberOfPublishers(cluster);
      if (
        processedConfig[symbol].priceAccounts?.[0]?.publishers &&
        processedConfig[symbol].priceAccounts[0].publishers.length >
          maximumNumberOfPublishers
      ) {
        return {
          isValid: false,
          error: `${symbol} has more than ${maximumNumberOfPublishers} publishers.`,
        };
      }
    }

    return {
      isValid: true,
      changes,
    };
  } catch (error) {
    return {
      isValid: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to validate configuration",
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
          productAccount: productAccountKey,
          priceAccount: priceAccountKey,
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
              pubkey: getMessageBufferAddressForPrice(cluster, priceAccountKey),
              isSigner: false,
              isWritable: true,
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
            priceAccount: priceAccountKey,
            fundingAccount,
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
            priceAccount: priceAccountKey,
            fundingAccount,
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
          productAccount: new PublicKey(prev.address || ""),
          priceAccount,
        })
        .instruction(),
    );

    // Delete product account
    instructions.push(
      await pythProgramClient.methods
        .delProduct()
        .accounts({
          fundingAccount,
          mappingAccount: accounts.rawConfig.mappingAccounts[0].address,
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
            payer: PRICE_FEED_OPS_KEY,
            messageBuffer: getMessageBufferAddressForPrice(
              cluster,
              priceAccount,
            ),
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
            priceAccount: new PublicKey(prevPrice.address || ""),
            fundingAccount,
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
            priceAccount: new PublicKey(prevPrice.address || ""),
            fundingAccount,
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
    const { prev, new: newChanges } = changes[symbol];

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

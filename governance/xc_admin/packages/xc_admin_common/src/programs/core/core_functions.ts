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
  GetConfigParams,
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
const sortObjectByKeys = <T extends Record<string, unknown>>(
  obj: T,
): Array<[string, unknown]> =>
  Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));

/**
 * Sort configuration data for consistent output
 */
function sortData(data: DownloadableConfig): DownloadableConfig {
  const sortedData: DownloadableConfig = {};
  const keys = Object.keys(data).sort();
  for (const key of keys) {
    const productData = data[key];
    const sortedKeyValues = sortObjectByKeys(productData.metadata);

    const sortedInnerData: DownloadableProduct = {
      address: productData.address,
      metadata: Object.fromEntries(sortedKeyValues) as Omit<
        Product,
        "price_account"
      >,
      priceAccounts: [],
    };

    // Sort price accounts by address
    sortedInnerData.priceAccounts = [...productData.priceAccounts]
      .sort((a, b) => a.address.localeCompare(b.address))
      .map((priceAccount) => {
        const sortedPriceAccount: DownloadablePriceAccount = {
          address: priceAccount.address,
          expo: priceAccount.expo,
          minPub: priceAccount.minPub,
          maxLatency: priceAccount.maxLatency,
          publishers: [...priceAccount.publishers].sort((a, b) =>
            a.localeCompare(b),
          ),
        };
        return sortedPriceAccount;
      });

    sortedData[key] = sortedInnerData;
  }
  return sortedData;
}

/**
 * Get the Pyth Core program address for the given cluster
 */
export function getProgramAddress(cluster: PythCluster): PublicKey {
  return getPythProgramKeyForCluster(cluster);
}

/**
 * Parse raw on-chain accounts into the Pyth Core configuration format
 */
export function getConfig(params: GetConfigParams): RawConfig {
  if (params.programType !== ProgramType.PYTH_CORE) {
    throw new Error("Invalid program type for Core getConfig");
  }

  const accounts = params.accounts;

  // First pass: Extract price accounts
  const priceRawConfigs = Object.fromEntries(
    accounts
      .filter(
        (account) =>
          parseBaseData(account.account.data)?.type === AccountType.Price,
      )
      .map((account) => {
        const parsed = parsePriceData(account.account.data);
        return [
          account.pubkey.toBase58(),
          {
            next: parsed.nextPriceAccountKey,
            address: account.pubkey,
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
        (account) =>
          parseBaseData(account.account.data)?.type === AccountType.Product,
      )
      .map((account) => {
        const parsed = parseProductData(account.account.data);
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
          account.pubkey.toBase58(),
          {
            priceAccounts,
            metadata: parsed.product,
            address: account.pubkey,
          },
        ];
      }),
  );

  // Third pass: Extract mapping accounts and permission data
  const rawConfig: RawConfig = { mappingAccounts: [] };

  // Process mapping accounts
  const mappingAccounts = accounts
    .filter(
      (account) =>
        parseBaseData(account.account.data)?.type === AccountType.Mapping,
    )
    .map((account) => {
      const parsed = parseMappingData(account.account.data);
      return {
        next: parsed.nextMappingAccount,
        address: account.pubkey,
        products: parsed.productAccountKeys
          .filter((key) => productRawConfigs[key.toBase58()])
          .map((key) => {
            const product = productRawConfigs[key.toBase58()];
            delete productRawConfigs[key.toBase58()];
            return product;
          }),
      };
    });

  rawConfig.mappingAccounts = mappingAccounts;

  // Find permission account if it exists
  const permissionAccount = accounts.find(
    (account) =>
      parseBaseData(account.account.data)?.type === AccountType.Permission,
  );

  if (permissionAccount) {
    rawConfig.permissionAccount = parsePermissionData(
      permissionAccount.account.data,
    );
  }

  return rawConfig;
}

/**
 * Format configuration for download as JSON
 */
export function getDownloadableConfig(
  rawConfig: RawConfig,
): DownloadableConfig {
  // Convert the raw config to a user-friendly format for download
  const symbolToData: DownloadableConfig = {};

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

  return sortData(symbolToData);
}

/**
 * Validate an uploaded configuration against the current configuration
 */
export function validateUploadedConfig(
  existingConfig: DownloadableConfig,
  uploadedConfig: unknown,
  cluster: PythCluster,
): ValidationResult {
  try {
    // Validate that the uploaded data is valid JSON
    if (typeof uploadedConfig !== "object" || uploadedConfig === null) {
      return { isValid: false, error: "Invalid JSON format" };
    }

    const uploadedConfigTyped = uploadedConfig as DownloadableConfig;
    const existingSymbols = new Set(Object.keys(existingConfig));
    const changes: Record<
      string,
      {
        prev?: Partial<DownloadableProduct>;
        new?: Partial<DownloadableProduct>;
      }
    > = {};

    // Check for changes to existing symbols
    for (const symbol of Object.keys(uploadedConfigTyped)) {
      // Remove duplicate publishers
      if (
        uploadedConfigTyped[symbol]?.priceAccounts?.[0]?.publishers &&
        Array.isArray(uploadedConfigTyped[symbol].priceAccounts[0].publishers)
      ) {
        uploadedConfigTyped[symbol].priceAccounts[0].publishers = [
          ...new Set(uploadedConfigTyped[symbol].priceAccounts[0].publishers),
        ];
      }

      if (!existingSymbols.has(symbol)) {
        // If symbol is not in existing symbols, create new entry
        const newProduct = { ...uploadedConfigTyped[symbol] };

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
        JSON.stringify(uploadedConfigTyped[symbol])
      ) {
        changes[symbol] = {
          prev: { ...existingConfig[symbol] },
          new: { ...uploadedConfigTyped[symbol] },
        };
      }
    }

    // Check for symbols to remove (in existing but not in uploaded)
    for (const symbol of Object.keys(existingConfig)) {
      if (!uploadedConfigTyped[symbol]) {
        changes[symbol] = {
          prev: { ...existingConfig[symbol] },
        };
      }
    }

    // Validate that address field is not changed for existing symbols
    for (const symbol of Object.keys(uploadedConfigTyped)) {
      if (
        existingSymbols.has(symbol) &&
        uploadedConfigTyped[symbol].address &&
        uploadedConfigTyped[symbol].address !== existingConfig[symbol].address
      ) {
        return {
          isValid: false,
          error: `Address field for product cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
        };
      }
    }

    // Validate that priceAccounts address field is not changed
    for (const symbol of Object.keys(uploadedConfigTyped)) {
      if (
        existingSymbols.has(symbol) &&
        uploadedConfigTyped[symbol].priceAccounts?.[0] &&
        existingConfig[symbol].priceAccounts?.[0] &&
        uploadedConfigTyped[symbol].priceAccounts[0].address &&
        uploadedConfigTyped[symbol].priceAccounts[0].address !==
          existingConfig[symbol].priceAccounts[0].address
      ) {
        return {
          isValid: false,
          error: `Address field for priceAccounts cannot be changed for symbol ${symbol}. Please revert any changes to the address field and try again.`,
        };
      }
    }

    // Check that no price account has more than the maximum number of publishers
    for (const symbol of Object.keys(uploadedConfigTyped)) {
      const maximumNumberOfPublishers = getMaximumNumberOfPublishers(cluster);
      if (
        uploadedConfigTyped[symbol].priceAccounts?.[0]?.publishers &&
        uploadedConfigTyped[symbol].priceAccounts[0].publishers.length >
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
    if (!prev && newChanges) {
      // deterministically generate product account key
      const productAccountKey: PublicKey = (
        await findDetermisticAccountAddress(
          AccountType.Product,
          symbol,
          cluster,
        )
      )[0];

      // Ensure metadata exists before attempting to use it
      if (newChanges.metadata) {
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
      }

      // deterministically generate price account key
      const priceAccountKey: PublicKey = (
        await findDetermisticAccountAddress(AccountType.Price, symbol, cluster)
      )[0];

      // Ensure priceAccounts exists and has at least one element
      if (newChanges.priceAccounts && newChanges.priceAccounts.length > 0) {
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
      }

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
      if (
        newChanges.priceAccounts &&
        newChanges.priceAccounts[0] &&
        newChanges.priceAccounts[0].publishers
      ) {
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
      }

      // create set min publisher instruction if minPub is defined
      if (
        newChanges.priceAccounts &&
        newChanges.priceAccounts[0] &&
        newChanges.priceAccounts[0].minPub !== undefined
      ) {
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
        newChanges.priceAccounts &&
        newChanges.priceAccounts[0] &&
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
    } else if (prev && !newChanges) {
      // Ensure priceAccounts exists and has at least one element with an address
      if (
        prev.priceAccounts &&
        prev.priceAccounts.length > 0 &&
        prev.priceAccounts[0].address
      ) {
        const priceAccount = new PublicKey(prev.priceAccounts[0].address);

        // if new is undefined, it means that the symbol is deleted
        // create delete price account instruction
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

        // create delete product account instruction
        instructions.push(
          await pythProgramClient.methods
            .delProduct()
            .accounts({
              fundingAccount,
              mappingAccount: rawConfig.mappingAccounts[0].address,
              productAccount: new PublicKey(prev.address || ""),
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
      }
    } else if (prev && newChanges) {
      // check if metadata has changed
      if (
        prev.metadata &&
        newChanges.metadata &&
        JSON.stringify(prev.metadata) !== JSON.stringify(newChanges.metadata)
      ) {
        const instruction = await pythProgramClient.methods
          .updProduct({ symbol, ...newChanges.metadata }) // If there's a symbol in newChanges.metadata, it will overwrite the current symbol
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

      if (
        prev.priceAccounts &&
        prev.priceAccounts[0] &&
        newChanges.priceAccounts &&
        newChanges.priceAccounts[0] &&
        prev.priceAccounts[0].expo !== newChanges.priceAccounts[0].expo
      ) {
        // create update exponent instruction
        instructions.push(
          await pythProgramClient.methods
            .setExponent(newChanges.priceAccounts[0].expo, 1)
            .accounts({
              fundingAccount,
              priceAccount: new PublicKey(prev.priceAccounts[0].address || ""),
            })
            .instruction(),
        );
      }

      // check if maxLatency has changed
      if (
        prev.priceAccounts &&
        prev.priceAccounts[0] &&
        newChanges.priceAccounts &&
        newChanges.priceAccounts[0] &&
        prev.priceAccounts[0].maxLatency !==
          newChanges.priceAccounts[0].maxLatency
      ) {
        // create update product account instruction
        instructions.push(
          await pythProgramClient.methods
            .setMaxLatency(newChanges.priceAccounts[0].maxLatency, [0, 0, 0])
            .accounts({
              priceAccount: new PublicKey(prev.priceAccounts[0].address || ""),
              fundingAccount,
            })
            .instruction(),
        );
      }

      // Check if both have valid price accounts with publishers
      if (
        prev.priceAccounts &&
        prev.priceAccounts[0] &&
        prev.priceAccounts[0].publishers &&
        newChanges.priceAccounts &&
        newChanges.priceAccounts[0] &&
        newChanges.priceAccounts[0].publishers
      ) {
        // We've already checked that these properties exist above
        const prevPublishers = prev.priceAccounts[0].publishers;
        const newPublishers = newChanges.priceAccounts[0].publishers;

        // check if publishers have changed
        const publisherKeysToAdd = newPublishers.filter(
          (newPublisher: string) => !prevPublishers.includes(newPublisher),
        );

        // check if there are any publishers to remove by comparing prev and new
        const publisherKeysToRemove = prevPublishers.filter(
          (prevPublisher: string) => !newPublishers.includes(prevPublisher),
        );

        // add instructions to remove publishers
        for (const publisherKey of publisherKeysToRemove) {
          instructions.push(
            await pythProgramClient.methods
              .delPublisher(new PublicKey(publisherKey))
              .accounts({
                fundingAccount,
                priceAccount: new PublicKey(
                  prev.priceAccounts[0].address || "",
                ),
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
                priceAccount: new PublicKey(
                  prev.priceAccounts[0].address || "",
                ),
              })
              .instruction(),
          );
          await initPublisherInPriceStore(publisherPubKey);
        }
      }

      // check if minPub has changed
      if (
        prev.priceAccounts &&
        prev.priceAccounts[0] &&
        newChanges.priceAccounts &&
        newChanges.priceAccounts[0] &&
        prev.priceAccounts[0].minPub !== newChanges.priceAccounts[0].minPub
      ) {
        // create update product account instruction
        instructions.push(
          await pythProgramClient.methods
            .setMinPub(newChanges.priceAccounts[0].minPub, [0, 0, 0])
            .accounts({
              priceAccount: new PublicKey(prev.priceAccounts[0].address || ""),
              fundingAccount,
            })
            .instruction(),
        );
      }
    }
  }

  return instructions;
}

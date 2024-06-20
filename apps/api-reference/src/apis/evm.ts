import type { ComponentProps } from "react";

import {
  type EvmCall as EvmCallComponent,
  Language,
  ParameterType,
} from "../components/EvmCall";

type EvmCall = Omit<ComponentProps<typeof EvmCallComponent>, "children"> & {
  description: string;
};

const BTCUSD =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const ETHUSD =
  "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

const getPrice: EvmCall = {
  name: "getPrice",
  description: `
Get the latest price and confidence interval for the requested price feed id.
The price feed id is a 32-byte id written as a hexadecimal string; see the
[price feed ids](https://pyth.network/developers/price-feed-ids) page to look up
the id for a given symbol. The returned price and confidence are decimal numbers
written in the form \`a * 10^e\`, where \`e\` is an exponent included in the
result. For example, a price of 1234 with an exponent of -2 represents the
number 12.34. The result also includes a \`publishTime\` which is the unix
timestamp for the price update.

This function reverts with a \`StalePrice\` error if the on-chain price has not
been updated within the last [getValidTimePeriod()](getValidTimePeriod)
seconds. The default valid time period is set to a reasonable default on each
chain and is typically around 1 minute. Call
[updatePriceFeeds](updatePriceFeeds) to pull a fresh price on-chain and solve
this problem. If you would like to configure the valid time period, see
[getPriceNoOlderThan](getPriceNoOlderThan). If you want the latest price
regardless of when it was updated, see [getPriceUnsafe](getPriceUnsafe).

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update. This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
`,
  parameters: [
    {
      name: "id",
      type: ParameterType.Hex,
      description: "The ID of the price feed you want to read",
    },
  ],
  examples: [
    {
      name: "BTC/USD",
      parameters: {
        id: BTCUSD,
      },
    },
    {
      name: "ETH/USD",
      parameters: {
        id: ETHUSD,
      },
    },
  ],
  code: [
    {
      language: Language.Solidity,
      code: (network, { id }) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress}
IPyth pyth = IPyth(contractAddress);

bytes32 priceId = ${id ?? "/* <id> */"};
PythStructs.Price memory currentBasePrice = pyth.getPrice(priceId);
        `,
    },
    {
      language: Language.EthersJSV6,
      code: (network, { id }) => `
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json" assert { type: "json" };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

const priceId = ${id ? `'${id}'` : "/* <id> */"};
const [price, conf, expo, timestamp] = await contract.getPrice(priceId);
        `,
    },
  ],
};

const getPriceUnsafe: EvmCall = {
  name: "getPriceUnsafe",
  description: `
Get the latest price and confidence interval for the requested price feed id.
The price feed id is a 32-byte id written as a hexadecimal string; see the
[price feed ids](https://pyth.network/developers/price-feed-ids) page to look up
the id for a given symbol. The returned price and confidence are decimal numbers
written in the form \`a * 10^e\`, where \`e\` is an exponent included in the
result. For example, a price of 1234 with an exponent of -2 represents the
number 12.34. The result also includes a \`publishTime\` which is the unix
timestamp for the price update.

**This function may return a price from arbitrarily far in the past.** It is the
caller's responsibility to check the returned \`publishTime\` to ensure that the
update is recent enough for their use case.

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update. This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
`,
  parameters: [
    {
      name: "id",
      type: ParameterType.Hex,
      description: "The ID of the price feed you want to read",
    },
  ],
  examples: [
    {
      name: "BTC/USD",
      parameters: {
        id: BTCUSD,
      },
    },
    {
      name: "ETH/USD",
      parameters: {
        id: ETHUSD,
      },
    },
  ],
  code: [
    {
      language: Language.Solidity,
      code: (network, { id }) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress};
IPyth pyth = IPyth(contractAddress);

bytes32 priceId = ${id ?? "/* <id> */"};
PythStructs.Price memory currentBasePrice = pyth.getPriceUnsafe(priceId);
        `,
    },
    {
      language: Language.EthersJSV6,
      code: (network, { id }) => `
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json" assert { type: "json" };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

const priceId = ${id ? `'${id}'` : "/* <id> */"};
const [price, conf, expo, timestamp] = await contract.getPriceUnsafe(priceId);
        `,
    },
  ],
};

const getPriceNoOlderThan: EvmCall = {
  name: "getPriceNoOlderThan",
  description: `
Get the latest price and confidence interval for the requested price feed id, if
it has been updated sufficiently recently.  The price feed id is a 32-byte id
written as a hexadecimal string; see the [price feed
ids](https://pyth.network/developers/price-feed-ids) page to look up the id for
a given symbol.  The returned price and confidence are decimal numbers written
in the form \`a * 10^e\`, where \`e\` is an exponent included in the result.
For example, a price of 1234 with an exponent of -2 represents the number 12.34.
The result also includes a \`publishTime\` which is the unix timestamp for the
price update.

The caller provides an \`age\` argument that specifies how old the price can be.
The call reverts with a \`StalePriceError\` if the on-chain price is from more
than \`age\` seconds in the past (with respect to the current on-chain
timestamp).  Call [updatePriceFeeds](updatePriceFeeds) to pull a fresh price
on-chain and solve this problem.

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update.  This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
`,
  parameters: [
    {
      name: "id",
      type: ParameterType.Hex,
      description: "The ID of the price feed you want to read",
    },
    {
      name: "age",
      type: ParameterType.Int,
      description: "Maximum age of the on-chain price in seconds.",
    },
  ],
  examples: [
    {
      name: "BTC/USD",
      parameters: {
        id: BTCUSD,
        age: "60",
      },
    },
    {
      name: "ETH/USD",
      parameters: {
        id: ETHUSD,
        age: "60",
      },
    },
  ],
  code: [
    {
      language: Language.Solidity,
      code: (network, { id, age }) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress};
IPyth pyth = IPyth(contractAddress);

bytes32 priceId = ${id ?? "/* <id> */"};
uint256 age = ${age ?? "/* <age> */"};
PythStructs.Price memory currentBasePrice = pyth.getPriceNoOlderThan(priceId, age);
        `,
    },
    {
      language: Language.EthersJSV6,
      code: (network, { id, age }) => `
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json" assert { type: "json" };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

const priceId = ${id ? `'${id}'` : "/* <id> */"};
const age = ${age ? `'${age}'` : "/* <age> */"};
const [price, conf, expo, timestamp] = await contract.getPriceNoOlderThan(priceId, age);
        `,
    },
  ],
};

const getEmaPrice: EvmCall = {
  name: "getEmaPrice",
  description: `
Get the latest exponentially-weighted moving average (EMA) price and confidence
interval for the requested price feed id.  The price feed id is a 32-byte id
written as a hexadecimal string; see the [price feed
ids](https://pyth.network/developers/price-feed-ids) page to look up the id for
a given symbol.  The returned price and confidence are decimal numbers written
in the form \`a * 10^e\`, where \`e\` is an exponent included in the result.
For example, a price of 1234 with an exponent of -2 represents the number 12.34.
The result also includes a \`publishTime\` which is the unix timestamp for the
price update.  The EMA methodology is described in more detail in this [blog
post](https://pythnetwork.medium.com/whats-in-a-name-302a03e6c3e1).

This function reverts with a \`StalePrice\` error if the on-chain price has not
been updated within the last [getValidTimePeriod()](getValidTimePeriod) seconds.
The default valid time period is set to a reasonable default on each chain and
is typically around 1 minute.  Call [updatePriceFeeds](updatePriceFeeds) to pull
a fresh price on-chain and solve this problem.  If you would like to configure
the valid time period, see [getEmaPriceNoOlderThan](getEmaPriceNoOlderThan).  If
you want the latest price regardless of when it was updated, see
[getEmaPriceUnsafe](getEmaPriceUnsafe).

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update.  This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
`,
  parameters: [
    {
      name: "id",
      type: ParameterType.Hex,
      description: "The ID of the price feed you want to read",
    },
  ],
  examples: [
    {
      name: "BTC/USD",
      parameters: {
        id: BTCUSD,
      },
    },
    {
      name: "ETH/USD",
      parameters: {
        id: ETHUSD,
      },
    },
  ],
  code: [
    {
      language: Language.Solidity,
      code: (network, { id }) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress}
IPyth pyth = IPyth(contractAddress);

bytes32 priceId = ${id ?? "/* <id> */"};
PythStructs.Price memory currentBasePrice = pyth.getEmaPrice(priceId);
        `,
    },
    {
      language: Language.EthersJSV6,
      code: (network, { id }) => `
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json" assert { type: "json" };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

const priceId = ${id ? `'${id}'` : "/* <id> */"};
const [price, conf, expo, timestamp] = await contract.getEmaPrice(priceId);
        `,
    },
  ],
};

const getEmaPriceUnsafe: EvmCall = {
  name: "getEmaPriceUnsafe",
  description: `
Get the latest exponentially-weighted moving average (EMA) price and confidence
interval for the requested price feed id.  The price feed id is a 32-byte id
written as a hexadecimal string; see the [price feed
ids](https://pyth.network/developers/price-feed-ids) page to look up the id for
a given symbol.  The returned price and confidence are decimal numbers written
in the form \`a * 10^e\`, where \`e\` is an exponent included in the result.
For example, a price of 1234 with an exponent of -2 represents the number 12.34.
The result also includes a \`publishTime\` which is the unix timestamp for the
price update.  The EMA methodology is described in more detail in this [blog
post](https://pythnetwork.medium.com/whats-in-a-name-302a03e6c3e1).

**This function may return a price from arbitrarily far in the past.** It is the
caller's responsibility to check the returned \`publishTime\` to ensure that the
update is recent enough for their use case.

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update.  This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
`,
  parameters: [
    {
      name: "id",
      type: ParameterType.Hex,
      description: "The ID of the price feed you want to read",
    },
  ],
  examples: [
    {
      name: "BTC/USD",
      parameters: {
        id: BTCUSD,
      },
    },
    {
      name: "ETH/USD",
      parameters: {
        id: ETHUSD,
      },
    },
  ],
  code: [
    {
      language: Language.Solidity,
      code: (network, { id }) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress}
IPyth pyth = IPyth(contractAddress);

bytes32 priceId = ${id ?? "/* <id> */"};
PythStructs.Price memory currentBasePrice = pyth.getEmaPriceUnsafe(priceId);
        `,
    },
    {
      language: Language.EthersJSV6,
      code: (network, { id }) => `
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json" assert { type: "json" };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

const priceId = ${id ? `'${id}'` : "/* <id> */"};
const [price, conf, expo, timestamp] = await contract.getEmaPriceUnsafe(priceId);
        `,
    },
  ],
};

const getEmaPriceNoOlderThan: EvmCall = {
  name: "getEmaPriceNoOlderThan",
  description: `
Get the latest exponentially-weighted moving average (EMA) price and confidence
interval for the requested price feed id.  The price feed id is a 32-byte id
written as a hexadecimal string; see the [price feed
ids](https://pyth.network/developers/price-feed-ids) page to look up the id for
a given symbol.  The returned price and confidence are decimal numbers written
in the form \`a * 10^e\`, where \`e\` is an exponent included in the result.
For example, a price of 1234 with an exponent of -2 represents the number 12.34.
The result also includes a \`publishTime\` which is the unix timestamp for the
price update.  The EMA methodology is described in more detail in this [blog
post](https://pythnetwork.medium.com/whats-in-a-name-302a03e6c3e1).

The caller provides an \`age\` argument that specifies how old the price can be.
The call reverts with a \`StalePriceError\` if the on-chain price is from more
than \`age\` seconds in the past (with respect to the current on-chain
timestamp).  Call [updatePriceFeeds](updatePriceFeeds) to pull a fresh price
on-chain and solve this problem.

This function reverts with a \`PriceFeedNotFound\` error if the requested feed
id has never received a price update.  This error could either mean that the
provided price feed id is incorrect, or (more typically) that this is the first
attempted use of that feed on-chain. In the second case, calling
[updatePriceFeeds](updatePriceFeeds) will solve this problem.
`,
  parameters: [
    {
      name: "id",
      type: ParameterType.Hex,
      description: "The ID of the price feed you want to read",
    },
    {
      name: "age",
      type: ParameterType.Int,
      description: "Maximum age of the on-chain price in seconds.",
    },
  ],
  examples: [
    {
      name: "BTC/USD",
      parameters: {
        id: BTCUSD,
        age: "60",
      },
    },
    {
      name: "ETH/USD",
      parameters: {
        id: ETHUSD,
        age: "60",
      },
    },
  ],
  code: [
    {
      language: Language.Solidity,
      code: (network, { id, age }) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress};
IPyth pyth = IPyth(contractAddress);

bytes32 priceId = ${id ?? "/* <id> */"};
uint256 age = ${age ?? "/* <age> */"};
PythStructs.Price memory currentBasePrice = pyth.getEmaPriceNoOlderThan(priceId, age);
        `,
    },
    {
      language: Language.EthersJSV6,
      code: (network, { id, age }) => `
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json" assert { type: "json" };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

const priceId = ${id ? `'${id}'` : "/* <id> */"};
const age = ${age ? `'${age}'` : "/* <age> */"};
const [price, conf, expo, timestamp] = await contract.getEmaPriceNoOlderThan(priceId, age);
        `,
    },
  ],
};

const getValidTimePeriod: EvmCall = {
  name: "getValidTimePeriod",
  description: `
Get the default valid time period in seconds.  This quantity is the maximum age
of price updates returned by functions like [getPrice](getPrice) and
[getEmaPrice](getEmaPrice); these functions revert if the current on-chain price
is older than this period.  The valid time period is configured to be a sane
default for each blockchain.
`,
  parameters: [],
  examples: [],
  code: [
    {
      language: Language.Solidity,
      code: (network) => `
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

// ${network.name}
address contractAddress = ${network.contractAddress};
IPyth pyth = IPyth(contractAddress);

uint validTimePeriod = pyth.getValidTimePeriod();
        `,
    },
    {
      language: Language.EthersJSV6,
      code: (network) => `
import { ethers } from "ethers";
import PythAbi from "@pythnetwork/pyth-sdk-solidity/abis/IPyth.json" assert { type: "json" };

// ${network.name}
const contractAddress = '${network.contractAddress}';
const provider = ethers.getDefaultProvider('${network.rpcUrl}');
const contract = new ethers.Contract(contractAddress, PythAbi, provider);

const [validTimePeriod] = await contract.getValidTimePeriod();
        `,
    },
  ],
};

export const evm = {
  getEmaPrice,
  getEmaPriceNoOlderThan,
  getEmaPriceUnsafe,
  getPrice,
  getPriceNoOlderThan,
  getPriceUnsafe,
  //     getUpdateFee
  getValidTimePeriod,
  //     parsePriceFeedUpdates
  //     parsePriceFeedUpdatesUnique
  //     updatePriceFeeds
  //     updatePriceFeedsIfNecessary
};

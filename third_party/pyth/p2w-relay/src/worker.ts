import { Mutex } from "async-mutex";
let CondVar = require("condition-variable");

import { setDefaultWasm } from "@certusone/wormhole-sdk/lib/cjs/solana/wasm";
import { uint8ArrayToHex } from "@certusone/wormhole-sdk";
import { Relay, RelayResult, RelayRetcode } from "./relay/iface";

import * as helpers from "./helpers";
import { logger } from "./helpers";
import { PromHelper } from "./promHelpers";
import {
  BatchPriceAttestation,
  getBatchAttestationHashKey,
  getBatchSummary,
} from "@pythnetwork/wormhole-attester-sdk";

const mutex = new Mutex();
let condition = new CondVar();
let conditionTimeout = 20000;

type PendingPayload = {
  vaa_bytes: string;
  batchAttestation: BatchPriceAttestation;
  receiveTime: Date;
  seqNum: number;
};

let pendingMap = new Map<string, PendingPayload>(); // The key to this is hash of price_ids in the batch attestation. Note that Map maintains insertion order, not key order.

type ProductData = {
  key: string;
  lastTimePublished: Date;
  numTimesPublished: number;
  lastBatchAttestation: BatchPriceAttestation;
  lastResult: any;
};

type CurrentEntry = {
  pendingEntry: PendingPayload;
  currObj: ProductData;
};

let productMap = new Map<string, ProductData>(); // The key to this is hash of price_ids in the batch attestation.

let relayImpl: Relay;
let metrics: PromHelper;
let nextBalanceQueryTimeAsMs: number = 0;
let balanceQueryInterval = 0;
let walletTimeStamp: Date;
let maxPerBatch: number = 1;
let maxAttempts: number = 2;
let retryDelayInMs: number = 0;
let maxHealthyNoRelayDurationInSeconds: number = 120;
let lastSuccessfulRelayTime: Date;

export function init(runWorker: boolean, relay: Relay): boolean {
  if (!runWorker) return true;

  relayImpl = relay;

  if (process.env.MAX_MSGS_PER_BATCH) {
    maxPerBatch = parseInt(process.env.MAX_MSGS_PER_BATCH);
  }

  if (maxPerBatch <= 0) {
    logger.error(
      "Environment variable MAX_MSGS_PER_BATCH has an invalid value of " +
        maxPerBatch +
        ", must be greater than zero."
    );

    return false;
  }

  if (process.env.RETRY_MAX_ATTEMPTS) {
    maxAttempts = parseInt(process.env.RETRY_MAX_ATTEMPTS);
  }

  if (maxAttempts <= 0) {
    logger.error(
      "Environment variable RETRY_MAX_ATTEMPTS has an invalid value of " +
        maxAttempts +
        ", must be greater than zero."
    );

    return false;
  }

  if (process.env.RETRY_DELAY_IN_MS) {
    retryDelayInMs = parseInt(process.env.RETRY_DELAY_IN_MS);
  }

  if (retryDelayInMs < 0) {
    logger.error(
      "Environment variable RETRY_DELAY_IN_MS has an invalid value of " +
        retryDelayInMs +
        ", must be positive or zero."
    );

    return false;
  }

  if (process.env.MAX_HEALTHY_NO_RELAY_DURATION_IN_SECONDS) {
    maxHealthyNoRelayDurationInSeconds = parseInt(
      process.env.MAX_HEALTHY_NO_RELAY_DURATION_IN_SECONDS
    );
  }

  if (maxHealthyNoRelayDurationInSeconds <= 0) {
    logger.error(
      "Environment variable MAX_HEALTHY_NO_RELAY_DURATION_IN_SECONDS has an invalid value of " +
        maxHealthyNoRelayDurationInSeconds +
        ", must be positive."
    );

    return false;
  }

  return true;
}

export async function run(met: PromHelper) {
  setDefaultWasm("node");

  metrics = met;

  await mutex.runExclusive(async () => {
    logger.info(
      "will attempt to relay each pyth message at most " +
        maxAttempts +
        " times, with a delay of " +
        retryDelayInMs +
        " milliseconds between attempts, will batch up to " +
        maxPerBatch +
        " pyth messages in a batch"
    );

    if (process.env.BAL_QUERY_INTERVAL) {
      balanceQueryInterval = parseInt(process.env.BAL_QUERY_INTERVAL);
    }

    try {
      let { address: payerAddress, balance: payerBalance } =
        await relayImpl.getPayerInfo();
      if (balanceQueryInterval !== 0) {
        logger.info(
          "initial wallet balance is " +
            payerBalance +
            ", will query every " +
            balanceQueryInterval +
            " milliseconds."
        );
        metrics.setWalletBalance(payerBalance);

        nextBalanceQueryTimeAsMs = new Date().getTime() + balanceQueryInterval;
      } else {
        logger.info("initial wallet balance is " + payerBalance);
        metrics.setWalletBalance(payerBalance);
      }
    } catch (e) {
      walletTimeStamp = new Date();
    }

    await condition.wait(computeTimeout(), callBack);
  });
}

async function callBack(err: any, result: any) {
  logger.debug(
    "entering callback, pendingEvents: " +
      pendingMap.size +
      ", err: %o, result: %o",
    err,
    result
  );

  await updateBalance();

  // condition = null;
  // await helpers.sleep(10000);
  // logger.debug("done with long sleep");
  let done = false;
  do {
    let currObjs = new Array<CurrentEntry>();
    let messages = new Array<string>();

    await mutex.runExclusive(async () => {
      condition = null;
      logger.debug("in callback, getting pending events.");
      await getPendingEventsAlreadyLocked(currObjs, messages);

      if (currObjs.length === 0) {
        done = true;
        condition = new CondVar();
        await condition.wait(computeTimeout(), callBack);
      }
    });

    if (currObjs.length !== 0) {
      logger.debug("in callback, relaying " + currObjs.length + " events.");
      let sendTime = new Date();
      let relayResult = await relayEventsNotLocked(messages);

      await mutex.runExclusive(async () => {
        logger.debug("in callback, finalizing " + currObjs.length + " events.");
        await finalizeEventsAlreadyLocked(currObjs, relayResult, sendTime);

        await updateBalance();

        if (pendingMap.size === 0) {
          logger.debug("in callback, rearming the condition.");
          done = true;
          condition = new CondVar();
          await condition.wait(computeTimeout(), callBack);
        }
      });
    }
  } while (!done);

  logger.debug("leaving callback.");
}

function computeTimeout(): number {
  if (balanceQueryInterval !== 0) {
    let now = new Date().getTime();
    if (now < nextBalanceQueryTimeAsMs) {
      return nextBalanceQueryTimeAsMs - now;
    }

    // Since a lot of time has passed, timeout in 1ms (0 means no-timeout)
    // In most cases this line should not be reached.
    return 1;
  }

  return conditionTimeout;
}

async function getPendingEventsAlreadyLocked(
  currObjs: Array<CurrentEntry>,
  messages: Array<string>
) {
  while (pendingMap.size !== 0 && currObjs.length < maxPerBatch) {
    const first = pendingMap.entries().next();
    logger.debug("processing event with key [" + first.value[0] + "]");
    const pendingValue: PendingPayload = first.value[1];
    let pendingKey = getBatchAttestationHashKey(pendingValue.batchAttestation);
    let currObj = productMap.get(pendingKey);
    if (currObj) {
      currObj.lastBatchAttestation = pendingValue.batchAttestation;
      currObj.lastTimePublished = new Date();
      productMap.set(pendingKey, currObj);
      logger.debug(
        "processing update " +
          currObj.numTimesPublished +
          " for [" +
          pendingKey +
          "], seq num " +
          pendingValue.seqNum
      );
    } else {
      logger.debug(
        "processing first update for [" +
          pendingKey +
          "], seq num " +
          pendingValue.seqNum
      );
      currObj = {
        key: pendingKey,
        lastBatchAttestation: pendingValue.batchAttestation,
        lastTimePublished: new Date(),
        numTimesPublished: 0,
        lastResult: "",
      };
      productMap.set(pendingKey, currObj);
    }

    currObjs.push({ pendingEntry: pendingValue, currObj: currObj });
    messages.push(pendingValue.vaa_bytes);
    pendingMap.delete(first.value[0]);
  }

  if (currObjs.length !== 0) {
    for (let idx = 0; idx < currObjs.length; ++idx) {
      pendingMap.delete(currObjs[idx].currObj.key);
    }
  }
}

const RELAY_SUCCESS: number = 0;
const RELAY_FAIL: number = 1;
const RELAY_ALREADY_EXECUTED: number = 2;
const RELAY_TIMEOUT: number = 3;
const RELAY_SEQ_NUM_MISMATCH: number = 4;
const RELAY_INSUFFICIENT_FUNDS: number = 5;

async function relayEventsNotLocked(
  messages: Array<string>
): Promise<RelayResult> {
  let relayResult: RelayResult | null = null;
  let retry: boolean = false;

  // CAUTION(2022-03-21): The retry logic is not very efficient at
  // handling more than one messsage. It may attempt redundant
  // transactions during retries for messasges that were successful on a
  // previous attempt.
  for (let attempt = 0; attempt < maxAttempts; ++attempt) {
    retry = false;

    relayResult = await relayImpl.relay(messages).catch((e) => {
      logger.error(
        `INTERNAL: Uncaught relayImpl.relay() exception, details:\n${JSON.stringify(
          e
        )}`
      );
      return new RelayResult(RelayRetcode.Fail, []);
    });

    switch (relayResult.code) {
      case RelayRetcode.Success:
      case RelayRetcode.AlreadyExecuted:
      case RelayRetcode.InsufficientFunds:
        logger.info(`Not retrying for relay retcode ${relayResult.code}`);
        break;

      case RelayRetcode.Fail:
      case RelayRetcode.SeqNumMismatch:
      case RelayRetcode.Timeout:
        retry = true;
        break;

      default:
        logger.warn(`Retrying for unknown relay retcode ${relayResult.code}`);
        retry = true;
        break;
    }

    logger.debug(
      "relay attempt complete: " +
        JSON.stringify(relayResult) +
        ", retry: " +
        retry +
        ", attempt " +
        attempt +
        " of " +
        maxAttempts
    );

    if (!retry) {
      break;
    } else {
      metrics.incRetries();
      if (retryDelayInMs != 0) {
        logger.debug(
          "delaying for " + retryDelayInMs + " milliseconds before retrying"
        );
        await helpers.sleep(retryDelayInMs * (attempt + 1));
      }
    }
  }
  if (retry) {
    logger.error("failed to relay batch, retry count exceeded!");
    metrics.incRetriesExceeded();
  }

  if (!relayResult) {
    logger.error("INTERNAL: worker failed to produce a relay result.");
    relayResult = new RelayResult(RelayRetcode.Fail, []);
  }

  return relayResult;
}

async function finalizeEventsAlreadyLocked(
  currObjs: Array<CurrentEntry>,
  relayResult: RelayResult,
  sendTime: Date
) {
  for (let idx = 0; idx < currObjs.length; ++idx) {
    let currObj = currObjs[idx].currObj;
    let currEntry = currObjs[idx].pendingEntry;
    currObj.lastResult = relayResult;
    currObj.numTimesPublished = currObj.numTimesPublished + 1;
    if (relayResult.code == RelayRetcode.Success) {
      metrics.incSuccesses();
    } else if (relayResult.code == RelayRetcode.AlreadyExecuted) {
      metrics.incAlreadyExec();
    } else if (relayResult.code == RelayRetcode.Timeout) {
      metrics.incTransferTimeout();
      metrics.incFailures();
    } else if (relayResult.code == RelayRetcode.SeqNumMismatch) {
      metrics.incSeqNumMismatch();
      metrics.incFailures();
    } else if (relayResult.code == RelayRetcode.InsufficientFunds) {
      metrics.incInsufficentFunds();
      metrics.incFailures();
    } else {
      metrics.incFailures();
    }
    productMap.set(currObj.key, currObj);

    let completeTime = new Date();
    metrics.setSeqNum(currEntry.seqNum);
    metrics.addCompleteTime(
      completeTime.getTime() - currEntry.receiveTime.getTime()
    );

    logger.info(
      "complete:" +
        "seqNum: " +
        currEntry.seqNum +
        ", price_ids: " +
        getBatchSummary(currEntry.batchAttestation) +
        ", rcv2SendBegin: " +
        (sendTime.getTime() - currEntry.receiveTime.getTime()) +
        ", rcv2SendComplete: " +
        (completeTime.getTime() - currEntry.receiveTime.getTime()) +
        ", totalSends: " +
        currObj.numTimesPublished +
        ", result: " +
        JSON.stringify(relayResult)
    );
  }

  if (relayResult.is_ok()) {
    lastSuccessfulRelayTime = new Date();
  }
}

async function updateBalance() {
  let now = new Date();
  if (balanceQueryInterval > 0 && now.getTime() >= nextBalanceQueryTimeAsMs) {
    try {
      let { address, balance } = await relayImpl.getPayerInfo();
      walletTimeStamp = new Date();
      logger.info(
        "wallet " +
          address +
          " balance: " +
          balance +
          ", update time: " +
          walletTimeStamp.toISOString()
      );
      metrics.setWalletBalance(balance);
    } catch (e) {
      logger.error("failed to query wallet balance:" + e);
    }
    nextBalanceQueryTimeAsMs = now.getTime() + balanceQueryInterval;
  }
}

export async function postEvent(
  vaaBytes: any,
  batchAttestation: BatchPriceAttestation,
  sequence: number,
  receiveTime: Date
) {
  let event: PendingPayload = {
    vaa_bytes: uint8ArrayToHex(vaaBytes),
    batchAttestation: batchAttestation,
    receiveTime: receiveTime,
    seqNum: sequence,
  };
  let pendingKey = getBatchAttestationHashKey(batchAttestation);
  await mutex.runExclusive(() => {
    logger.debug("posting event with key [" + pendingKey + "]");
    pendingMap.set(pendingKey, event);
    if (condition) {
      logger.debug("hitting condition variable.");
      condition.complete(true);
    }
  });
}

export async function getStatus() {
  let result = "[";
  await mutex.runExclusive(() => {
    let first: boolean = true;
    for (let [key, value] of productMap) {
      if (first) {
        first = false;
      } else {
        result = result + ", ";
      }

      let item: object = {
        summary: getBatchSummary(value.lastBatchAttestation),
        num_times_published: value.numTimesPublished,
        last_time_published: value.lastTimePublished.toISOString(),
        result: value.lastResult,
      };

      result = result + JSON.stringify(item);
    }
  });

  result = result + "]";
  return result;
}

// Note that querying the contract does not update the sequence number, so we don't need to be locked.
export async function getPriceData(priceId: string): Promise<any> {
  let result: any;
  // await mutex.runExclusive(async () => {
  result = await relayImpl.query(priceId);
  // });

  return result;
}

export function isHealthy(): boolean {
  if (lastSuccessfulRelayTime === undefined) {
    return false;
  }

  const currentDate = new Date();
  const timeDiffMs = currentDate.getTime() - lastSuccessfulRelayTime.getTime();

  if (timeDiffMs > maxHealthyNoRelayDurationInSeconds * 1000) {
    return false;
  }

  return true;
}

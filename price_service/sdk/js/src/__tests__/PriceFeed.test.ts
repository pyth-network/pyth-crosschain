import { Price, PriceFeed, PriceFeedMetadata } from "../index";

beforeAll(() => {
  jest.useFakeTimers();
});

test("Parsing Price Feed works as expected", () => {
  const data = {
    ema_price: {
      conf: "2",
      expo: 4,
      price: "3",
      publish_time: 11,
    },
    id: "abcdef0123456789",
    price: {
      conf: "1",
      expo: 4,
      price: "10",
      publish_time: 11,
    },
  };

  const priceFeed = PriceFeed.fromJson(data);
  expect(priceFeed.id).toBe("abcdef0123456789");

  const expectedPrice = new Price({
    conf: "1",
    expo: 4,
    price: "10",
    publishTime: 11,
  });
  expect(priceFeed.getPriceUnchecked()).toStrictEqual(expectedPrice);

  const expectedEmaPrice = new Price({
    conf: "2",
    expo: 4,
    price: "3",
    publishTime: 11,
  });
  expect(priceFeed.getEmaPriceUnchecked()).toStrictEqual(expectedEmaPrice);

  jest.setSystemTime(20000);
  expect(priceFeed.getPriceNoOlderThan(15)).toStrictEqual(expectedPrice);
  expect(priceFeed.getPriceNoOlderThan(5)).toBeUndefined();
  expect(priceFeed.getEmaPriceNoOlderThan(15)).toStrictEqual(expectedEmaPrice);
  expect(priceFeed.getEmaPriceNoOlderThan(5)).toBeUndefined();

  expect(priceFeed.toJson()).toEqual(data);
});

test("getMetadata returns PriceFeedMetadata as expected", () => {
  const data = {
    ema_price: {
      conf: "2",
      expo: 4,
      price: "3",
      publish_time: 11,
    },
    id: "abcdef0123456789",
    price: {
      conf: "1",
      expo: 4,
      price: "10",
      publish_time: 11,
    },
    metadata: {
      attestation_time: 7,
      emitter_chain: 8,
      price_service_receive_time: 9,
      sequence_number: 10,
      something_else: 11, // Ensuring the code is future compatible.
    },
  };

  const priceFeed = PriceFeed.fromJson(data);

  expect(priceFeed.getMetadata()).toStrictEqual(
    PriceFeedMetadata.fromJson({
      attestation_time: 7,
      emitter_chain: 8,
      price_service_receive_time: 9,
      sequence_number: 10,
    }),
  );
});

test("getVAA returns string as expected", () => {
  const data = {
    ema_price: {
      conf: "2",
      expo: 4,
      price: "3",
      publish_time: 11,
    },
    id: "abcdef0123456789",
    price: {
      conf: "1",
      expo: 4,
      price: "10",
      publish_time: 11,
    },
    vaa: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
  };

  const priceFeed = PriceFeed.fromJson(data);

  expect(priceFeed.getVAA()).toStrictEqual(
    "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
  );
});

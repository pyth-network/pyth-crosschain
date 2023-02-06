import {
  parseBatchPriceAttestation,
  Price,
  PriceFeed,
  PriceAttestation,
  PriceAttestationStatus,
  priceAttestationToPriceFeed,
} from "../index";

describe("Deserializing Batch Price Attestation works", () => {
  test("when batch has 3 price feeds", () => {
    // Generated from the rust sdk test_batch_serde
    const fixture =
      "50325748000300010001020003009D01010101010101010101010101010101010101010101010101010" +
      "10101010101FEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFEFE0000002B" +
      "AD2FEED70000000000000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D00" +
      "000DEADBEEFFADE00000000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEFDEAD" +
      "BEEFFADEDEAF0202020202020202020202020202020202020202020202020202020202020202FDFDFDF" +
      "DFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFDFD0000002BAD2FEED70000000000" +
      "000065FFFFFFFDFFFFFFFFFFFFFFD6000000000000002A010001E14C0004E6D00000DEADBEEFFADE000" +
      "00000DADEBEEF00000000DEADBABE0000DEADFACEBEEF000000BADBADBEEFDEADBEEFFADEDEAF030303" +
      "0303030303030303030303030303030303030303030303030303030303FCFCFCFCFCFCFCFCFCFCFCFCF" +
      "CFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFCFC0000002BAD2FEED70000000000000065FFFFFFFDFFFF" +
      "FFFFFFFFFFD6000000000000002A010001E14C0004E6D00000DEADBEEFFADE00000000DADEBEEF00000" +
      "000DEADBABE0000DEADFACEBEEF000000BADBADBEEFDEADBEEFFADEDEAF";

    const data = Buffer.from(fixture, "hex");
    const batchPriceAttestation = parseBatchPriceAttestation(data);

    expect(batchPriceAttestation.priceAttestations.length).toBe(3);

    // values are from the rust sdk mock_attestation
    batchPriceAttestation.priceAttestations.forEach((pa, idx) => {
      expect(pa).toEqual<PriceAttestation>({
        productId: Buffer.from(Array(32).fill(idx + 1)).toString("hex"),
        priceId: Buffer.from(Array(32).fill(255 - idx - 1)).toString("hex"),
        price: (0x2bad2feed7).toString(),
        conf: "101",
        emaPrice: "-42",
        emaConf: "42",
        expo: -3,
        status: PriceAttestationStatus.Trading,
        numPublishers: 123212,
        maxNumPublishers: 321232,
        attestationTime: 0xdeadbeeffade,
        publishTime: 0xdadebeef,
        prevPublishTime: 0xdeadbabe,
        prevPrice: (0xdeadfacebeef).toString(),
        prevConf: (0xbadbadbeef).toString(),
      });
    });
  });
});

describe("Price Attestation to Price Feed works", () => {
  test("when status is trading", () => {
    const priceAttestation = {
      productId: "012345",
      priceId: "abcde",
      price: "100",
      conf: "5",
      emaPrice: "103",
      emaConf: "3",
      expo: -3,
      status: PriceAttestationStatus.Trading,
      numPublishers: 1,
      maxNumPublishers: 2,
      attestationTime: 1000,
      publishTime: 1000,
      prevPublishTime: 998,
      prevPrice: "101",
      prevConf: "6",
    };

    const priceFeed = priceAttestationToPriceFeed(priceAttestation);
    expect(priceFeed).toEqual(
      new PriceFeed({
        id: "abcde",
        price: new Price({
          price: "100",
          conf: "5",
          expo: -3,
          publishTime: 1000,
        }),
        emaPrice: new Price({
          price: "103",
          conf: "3",
          expo: -3,
          publishTime: 1000,
        }),
      })
    );
  });

  test("when status is not trading", () => {
    const priceAttestation = {
      productId: "012345",
      priceId: "abcde",
      price: "100",
      conf: "5",
      emaPrice: "103",
      emaConf: "3",
      expo: -3,
      status: PriceAttestationStatus.Unknown,
      numPublishers: 1,
      maxNumPublishers: 2,
      attestationTime: 1000,
      publishTime: 1000,
      prevPublishTime: 998,
      prevPrice: "101",
      prevConf: "6",
    };

    const priceFeed = priceAttestationToPriceFeed(priceAttestation);
    expect(priceFeed).toEqual(
      new PriceFeed({
        id: "abcde",
        price: new Price({
          price: "101",
          conf: "6",
          expo: -3,
          publishTime: 998,
        }),
        emaPrice: new Price({
          price: "103",
          conf: "3",
          expo: -3,
          publishTime: 998,
        }),
      })
    );
  });
});

import {
  parseAccumulatorUpdateData,
  parsePriceFeedMessage,
  parseTwapMessage,
  sliceAccumulatorUpdateData,
} from "../AccumulatorUpdateData";

// This is just a sample update data from hermes
const TEST_ACCUMULATOR_UPDATE_DATA =
  "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";

describe("Test parse accumulator update", () => {
  test("Happy path", async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { vaa, updates } = parseAccumulatorUpdateData(
      Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64"),
    );

    const priceMessages = updates.map((update) => {
      return parsePriceFeedMessage(update.message);
    });
    expect(priceMessages[0].feedId.toString("hex")).toBe(
      "c96458d393fe9deb7a7d63a0ac41e2898a67a7750dbd166673279e06c868df0a",
    );
    expect(priceMessages[0].price.toString()).toBe("4689500");
    expect(priceMessages[0].confidence.toString()).toBe("6174");
    expect(priceMessages[0].exponent).toBe(-8);
    expect(priceMessages[0].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[0].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[0].emaPrice.toString()).toBe("4690654");
    expect(priceMessages[0].emaConf.toString()).toBe("6257");

    expect(priceMessages[1].feedId.toString("hex")).toBe(
      "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    );
    expect(priceMessages[1].price.toString()).toBe("294943041422");
    expect(priceMessages[1].confidence.toString()).toBe("184284043");
    expect(priceMessages[1].exponent).toBe(-8);
    expect(priceMessages[1].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[1].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[1].emaPrice.toString()).toBe("294580230000");
    expect(priceMessages[1].emaConf.toString()).toBe("239495968");

    expect(priceMessages[2].feedId.toString("hex")).toBe(
      "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    );
    expect(priceMessages[2].price.toString()).toBe("14802549538");
    expect(priceMessages[2].confidence.toString()).toBe("9930888");
    expect(priceMessages[2].exponent).toBe(-8);
    expect(priceMessages[2].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[2].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[2].emaPrice.toString()).toBe("14732272500");
    expect(priceMessages[2].emaConf.toString()).toBe("10975810");
  });

  test("Slice accumulator update data", async () => {
    expect(
      parseAccumulatorUpdateData(
        sliceAccumulatorUpdateData(
          Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64"),
          2,
          1,
        ),
      ).updates.length,
    ).toBe(0);

    expect(
      parseAccumulatorUpdateData(
        sliceAccumulatorUpdateData(
          Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64"),
          0,
          5,
        ),
      ).updates.length,
    ).toBe(3);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { vaa, updates } = parseAccumulatorUpdateData(
      sliceAccumulatorUpdateData(
        Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64"),
        1,
        3,
      ),
    );

    const priceMessages = updates.map((update) => {
      return parsePriceFeedMessage(update.message);
    });
    expect(priceMessages[0].feedId.toString("hex")).toBe(
      "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    );
    expect(priceMessages[0].price.toString()).toBe("294943041422");
    expect(priceMessages[0].confidence.toString()).toBe("184284043");
    expect(priceMessages[0].exponent).toBe(-8);
    expect(priceMessages[0].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[0].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[0].emaPrice.toString()).toBe("294580230000");
    expect(priceMessages[0].emaConf.toString()).toBe("239495968");

    expect(priceMessages[1].feedId.toString("hex")).toBe(
      "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    );
    expect(priceMessages[1].price.toString()).toBe("14802549538");
    expect(priceMessages[1].confidence.toString()).toBe("9930888");
    expect(priceMessages[1].exponent).toBe(-8);
    expect(priceMessages[1].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[1].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[1].emaPrice.toString()).toBe("14732272500");
    expect(priceMessages[1].emaConf.toString()).toBe("10975810");
  });

  test("Wrong magic number", async () => {
    const data = Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64");
    data[0] = 0;
    expect(() => parseAccumulatorUpdateData(data)).toThrow(
      "Invalid accumulator message",
    );
  });

  test("Parse TWAP message", () => {
    // Sample data from the Hermes latest TWAP endpoint.
    const testAccumulatorDataTwap =
      "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";
    const { updates } = parseAccumulatorUpdateData(
      Buffer.from(testAccumulatorDataTwap, "base64"),
    );

    // Test that both messages are parsed successfully
    const twapMessage1 = parseTwapMessage(updates[0].message);
    expect(twapMessage1.feedId.toString("hex")).toBe(
      "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
    );
    expect(twapMessage1.cumulativePrice.toString()).toBe("1760238576144013");
    expect(twapMessage1.cumulativeConf.toString()).toBe("5113466755162");
    expect(twapMessage1.numDownSlots.toString()).toBe("72037403");
    expect(twapMessage1.exponent).toBe(-5);
    expect(twapMessage1.publishTime.toString()).toBe("1733155135");
    expect(twapMessage1.prevPublishTime.toString()).toBe("1733155134");
    expect(twapMessage1.publishSlot.toString()).toBe("181871343");

    const twapMessage2 = parseTwapMessage(updates[1].message);
    expect(twapMessage2.feedId.toString("hex")).toBe(
      "2b9ab1e972a281585084148ba1389800799bd4be63b957507db1349314e47445",
    );
    expect(twapMessage2.cumulativePrice.toString()).toBe("949830028892149802");
    expect(twapMessage2.cumulativeConf.toString()).toBe("973071467813959");
    expect(twapMessage2.numDownSlots.toString()).toBe("27140");
    expect(twapMessage2.exponent).toBe(-8);
    expect(twapMessage2.publishTime.toString()).toBe("1733155135");
    expect(twapMessage2.prevPublishTime.toString()).toBe("1733155134");
    expect(twapMessage2.publishSlot.toString()).toBe("181871343");
  });
});

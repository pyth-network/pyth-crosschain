import {
  parseAccumulatorUpdateData,
  parsePriceFeedMessage,
  sliceAccumulatorUpdateData,
} from "../AccumulatorUpdateData";

// This is just a sample update data from hermes
const TEST_ACCUMULATOR_UPDATE_DATA =
  "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";

describe("Test parse accumulator update", () => {
  test("Happy path", async () => {
    const { vaa, updates } = parseAccumulatorUpdateData(
      Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64")
    );

    const priceMessages = updates.map((update) => {
      return parsePriceFeedMessage(update.message);
    });
    expect(priceMessages[0].feedId.toString("hex")).toBe(
      "c96458d393fe9deb7a7d63a0ac41e2898a67a7750dbd166673279e06c868df0a"
    );
    expect(priceMessages[0].price.toString()).toBe("4689500");
    expect(priceMessages[0].confidence.toString()).toBe("6174");
    expect(priceMessages[0].exponent).toBe(-8);
    expect(priceMessages[0].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[0].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[0].emaPrice.toString()).toBe("4690654");
    expect(priceMessages[0].emaConf.toString()).toBe("6257");

    expect(priceMessages[1].feedId.toString("hex")).toBe(
      "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
    );
    expect(priceMessages[1].price.toString()).toBe("294943041422");
    expect(priceMessages[1].confidence.toString()).toBe("184284043");
    expect(priceMessages[1].exponent).toBe(-8);
    expect(priceMessages[1].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[1].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[1].emaPrice.toString()).toBe("294580230000");
    expect(priceMessages[1].emaConf.toString()).toBe("239495968");

    expect(priceMessages[2].feedId.toString("hex")).toBe(
      "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
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
          1
        )
      ).updates.length
    ).toBe(0);

    expect(
      parseAccumulatorUpdateData(
        sliceAccumulatorUpdateData(
          Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64"),
          0,
          5
        )
      ).updates.length
    ).toBe(3);

    const { vaa, updates } = parseAccumulatorUpdateData(
      sliceAccumulatorUpdateData(
        Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64"),
        1,
        3
      )
    );

    const priceMessages = updates.map((update) => {
      return parsePriceFeedMessage(update.message);
    });
    expect(priceMessages[0].feedId.toString("hex")).toBe(
      "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
    );
    expect(priceMessages[0].price.toString()).toBe("294943041422");
    expect(priceMessages[0].confidence.toString()).toBe("184284043");
    expect(priceMessages[0].exponent).toBe(-8);
    expect(priceMessages[0].publishTime.toString()).toBe("1715627146");
    expect(priceMessages[0].prevPublishTime.toString()).toBe("1715627145");
    expect(priceMessages[0].emaPrice.toString()).toBe("294580230000");
    expect(priceMessages[0].emaConf.toString()).toBe("239495968");

    expect(priceMessages[1].feedId.toString("hex")).toBe(
      "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
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
      "Invalid accumulator message"
    );
  });
});

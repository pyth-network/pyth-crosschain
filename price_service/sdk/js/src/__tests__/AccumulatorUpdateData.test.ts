import {
  parseAccumulatorUpdateData,
  parsePriceFeedMessage,
} from "../AccumulatorUpdateData";

// This is just a sample update data from hermes
const TEST_ACCUMULATOR_UPDATE_DATA =
  "UE5BVQEAAAADuAEAAAADDQILBDsleD7xENCN7O7KjXAe15OQQ8FvD0E6L+bIemppBjNEZEOF0XuxCPQ/ti4gWUplKpieCWYiibuaDvXOeSFFAQOuYekUPV6yqK2BRWo/KRmJ00SV01OJDRhNzc1YnzUi+j8dt1tNBkVY99NIs5leyixUmeq4Dn1n8y37xN4JtAacAQSxJzGeZ6tejBD1YlPBlVwaCX8crkp19R1es7rDBhX/iit2plz5grz66fPj/mpoffZqKo95Fq/0sxWHIvn4nhgXAQYLl99cpa6KlaA8q1Pj7sN6TXNrXtmTBlzRU6dZ0ptO8VKp4K3zkVqbWkB5mbHCeuYNgOGMCnVsS7Ce9J7NganNAQf0nyez/5yR/U2zu+XRbi8eNzI1yJ9Hc4lmMl8pTPPQRgrs9HyiVCliCOcHdLzLio3JoLBhmFxQ3ygYj2eB+k3UAQgHX1e/+vbCjBNnmx/UQV8m0y/wifKAMfYpK4mR8voG3wgxo5MIFUvvCZ9/Gt1GizTX5CuoQD9J4ioxjoCFghVtAQqG5lFSpVRpC0dQlMv2ju2K89Ph0tJGsX7LGRXRnh9lEkkM8W+Uxf1R50HFsZHiXU08Grz0mKRPavesrzD+1xYGAQuYL6q5SagvBS7TfZJYS4kUMw74TvMiHLWx2ps3EdEJbh3WCWGfOM3amrplQBnqctDYh3StqspyTdaU5QTxfyYvAQwNWdPBEtAR6yIHB8KYrEDGGUH91uqD768NGigW6ziLwnNw2un+gcDUiafL3pZpqC4yIDhmnEz26PmQs4cAI5nkAA3/Zl3Pt7fLG3E5xBa/lbdrBUT3J+znFExbuFZuZipvbBwnQq/yyBSXqyfuHG3GTQZ/wXBto5zUEyex9889XYzaAQ52EUUCG0X4i0nWHeAf00+s6cODkW6hanQ1MHfTdvvVMXqK9nfvicz8pBna/NVp1wiTN5zR9rWjQuAf0g0c6TRLARCPT46a0/3xER/tV7WLQ6JQUWHMbV0G6cXKmdFT0Qg3/m08Dlabic+EHW9u2ugZA5sJ/Jl4oGk/lWLJoNoxDFMZARJgsgN2RdhjvJMRmf/Kj0d5PSvI7kE+J7ShlJd5058+ETZVPR15fJpT3BWUJ8i/vdGmU90A6iGyXRmNRBFx21qqAGXeGOEAAAAAABrhAfrtrFhR4yubI7X5QRqMK6xKrj7U3XuBHdGnLqSqcQAAAAACjFEsAUFVV1YAAAAAAAeUpesAACcQy5naBQ5EEmAnr2RvKBD1SUJH9zwBAFUA7w2Lb9os66QdoV1AldHaOSoNL47Qxse8D0z6yMKAtW0AAAACgAWPuQAAAAAAX+C0////+AAAAABl3hjhAAAAAGXeGOEAAAACgrM/OAAAAAAAaAvYCuE9uKnM0BlXJ1E/fLYtWytcVLhkSCzHW9p1ReYbPMt07qbcN5KykfYDlCJxjBT3UmyTbhTT30PmOLkZu9zraLg22Wysdg1W67WoQZi654djZPBpAiHRU2KQXbDSGqJcekD0W+TqKO+QagPAoXksP0iMGEYpBdVZKGhSvw0NpXv/5Qb5NHO/+dTahPFBgXJH+9geJaxYru9ZRMg5o+YjIvkwuom/2NP0mTbfp4syeDQBs+fmcdGmAjgcdF0wt1gR6kYbsWQ/CZ08";
describe("Test parse accumulator update", () => {
  test("Happy path", async () => {
    const { vaa, updates } = parseAccumulatorUpdateData(
      Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64")
    );

    const priceMessage = parsePriceFeedMessage(updates[0].message);
    expect(priceMessage.feedId.toString("hex")).toBe(
      "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
    );
    expect(priceMessage.price.toString()).toBe("10737782713");
    expect(priceMessage.confidence.toString()).toBe("6283444");
    expect(priceMessage.exponent).toBe(-8);
    expect(priceMessage.publishTime.toString()).toBe("1709054177");
    expect(priceMessage.prevPublishTime.toString()).toBe("1709054177");
    expect(priceMessage.emaPrice.toString()).toBe("10782719800");
    expect(priceMessage.emaConf.toString()).toBe("6818776");
  });

  test("Wrong magic number", async () => {
    const data = Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64");
    data[0] = 0;
    expect(() => parseAccumulatorUpdateData(data)).toThrow(
      "Invalid accumulator message"
    );
  });
});

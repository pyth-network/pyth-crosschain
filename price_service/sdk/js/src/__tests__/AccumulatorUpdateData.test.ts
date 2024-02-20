import { parseAccumulatorUpdateData } from "../AccumulatorUpdateData";

const TEST_ACCUMULATOR_UPDATE_DATA =
  "UE5BVQEAAAADuAEAAAADDQCRWcud7VE0FQkptV7iZh1Ls8O4dszQ4HmdOZLNDVQiQnMB5Q9jVd52Y9IMI8k1QhOhT2xn82hveqZ6AIn+c6vPAQL4nN+ynbzaJnbGFpWW5ysEA811BblKr+DXO5I5tD3SgEjPmByPIEVPHRqdgnq7M8r6AG4q8qfbmeonROr67i4eAAPVteKrUXD6f13GG/Qj0xHcJ/NuR+xwrbs6KGmYZHq0fHv4m0C3LPIOgVo9iy2ednK5IB/pAEMoaGK/fwoL2ouSAQSulF0XQGZ0J5oFKvCwPBSZOYtITwEQSicnwIWu9a+j7SjMh/zF4vtqWFAqfkFatVMZI6/dkQkmwlcMkEkGHvN5AQZYiYD8teZVpmCzn9jxZo/qTF4qrWgrHWv3/i4kZsXmkDSq1QTiYd7ikQQVWVxgH3PKl03SPFvqoc7SmwKIZKyyAQjfPTwpqeTTi0zFRyyb9HKMYjcbXEcuRXn7uOaNF83ry1s+cudCcWsiaCNYEPzv1BvHxgYYXcx2MkNxUbXiLlmoAQpQSpOkNb9780k2EsrUjZd/ieD+sTQA6P0iZWL5jA8ONEi46mAufCfRlAO2a5jfUvjuN4Z/ZOklgT9eZ7v3JoleAAv/2wkZ5rQx+cl/jlL9k6rbzrDU8sYLTJnlFTsuOr66/iVUqCe0Clwv682NgvH8yLbtw9He/vdn3OeLn19eDU0qAQxk47DIhc9EAtNrdhFSyAoEBtQtgcxRvSnjIIMPTGIhIzv52WFY/I2CwyKcQLhERdjjfh7EhZvBUXHTFRk2xjc2AA3wNaGbjUXsJqL8VyBQg7t0dILbUQ8AiOZJQVfx+L+1mFVZAc4v8/0BWsIF5b7+YmoN6psArWCvZcd9Hkjuxda4AQ5Rxgs32U2Jm43W4voTk42MibgvPMas3xQbuCW88pH1skdSTfvtgoIOa6BdoS3YEUJu78a0X3AiIUem1fDOdOs7AA/lHyqNz4vwuTNs8U6G51VqO2g1yEJyRwrMqsjEvK9VC0EjieacqPBwPL9/DMssbHU01bL+YzEY5XTxi1QiBeyFABJuE+6jHgEh9WvwaPDZe7me9sl5EiPDUxAAryErsB0LDTrnzls7qgDymCp+MSJur8U4I08ul/mL1rVesK3uUqqtAGV20Z0AAAAAABrhAfrtrFhR4yubI7X5QRqMK6xKrj7U3XuBHdGnLqSqcQAAAAAB1IYyAUFVV1YAAAAAAAbbm1gAACcQralfDHbB9c321F6ngWz+RspcmdsBAFUAyWRY05P+net6fWOgrEHiiYpnp3UNvRZmcyeeBsho3woAAAAAAFEIJAAAAAAAAAxT////+AAAAABldtGcAAAAAGV20ZsAAAAAAFEWJQAAAAAAAAu6CqMvc3++cZquwewCu6kJe8aPB1SFPI41uwi10MgNwqRbCue30EvorUjF4mKpFB+Cwx8KH5bFnAAX13DPmu7OCbX7k0LdKtr9pb8zPVsXwlx+BteFyBWNtJmeLIx7tG88H2uARL/B+MJw2GcVujs6qdnIQkIjjBdDIR3XRtY2zMfK58eeXuiAkJDHIQ3H41GmYRAVe8FtPvtMWTY51Q63Tkmfq60qsB1yy4Srd5QI/x60eBnOlAYC67+gjB0sGHLrjSapbXzGUf//";

describe("Test parse accumulator update", () => {
  test("Happy path", async () => {
    parseAccumulatorUpdateData(
      Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64")
    );
  });

  test("Wrong magic number", async () => {
    const data = Buffer.from(TEST_ACCUMULATOR_UPDATE_DATA, "base64");
    data[0] = 0;
    expect(() => parseAccumulatorUpdateData(data)).toThrow(
      "Invalid accumulator message"
    );
  });
});

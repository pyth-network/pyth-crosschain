import express from "express";
import axios, { AxiosError } from "axios";
import bodyParser from "body-parser";

const UNDERLYING_URL = "https://goerli.optimism.io";

const IGNORE_METHODS = [
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getBlockByNumber",
  "eth_feeHistory",
  "eth_call",
];
const app = express();
const port = 8080;

function logRequest(req: any) {}

// Use body-parser to parse JSON request bodies
app.use(bodyParser.json());

// Handle POST requests to /
app.post("/", async (req, res) => {
  try {
    if (req.method == "POST") {
      const ethMethod = req.body.method;
      const logsEnabled = !IGNORE_METHODS.includes(ethMethod);

      if (logsEnabled) {
        // Get the URL to proxy to from the request body
        console.log(
          `[-->] ${req.method} url: ${req.url} path: ${
            req.path
          } params: ${JSON.stringify(req.params)}`
        );
        console.log(`      ${JSON.stringify(req.body)}`);
      }

      if (ethMethod === "FOOOOOO") {
      } else {
        // default fallback is to proxy the data to the underlying rpc node.
        const destUrl = `${UNDERLYING_URL}${req.path}`;
        const response = await axios.post(destUrl, req.body);

        if (logsEnabled) {
          console.log(
            `[<--] ${response.status} ${JSON.stringify(response.data)}`
          );
        }
        res.status(response.status).send(response.data);
      }
    } else {
      res.status(405).send(`Unsupported method: ${req.method} is not allowed`);
    }
  } catch (error) {
    // Handle errors and return an error response
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      res.status(axiosError.response?.status || 500).send(axiosError.message);
    } else {
      res.status(500).send(error);
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Proxy server listening at http://localhost:${port}`);
});

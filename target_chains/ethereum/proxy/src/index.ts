import express from "express";
import axios, { AxiosError } from "axios";
import bodyParser from "body-parser";

const UNDERLYING_URL = "https://goerli.optimism.io";

const app = express();
const port = 8080;

// Use body-parser to parse JSON request bodies
app.use(bodyParser.json());

// Handle POST requests to /
app.post("/", async (req, res) => {
  try {
    // Get the URL to proxy to from the request body
    console.log(
      `[-->] ${req.method} url: ${req.url} path: ${
        req.path
      } params: ${JSON.stringify(req.params)}`
    );
    console.log(`      ${JSON.stringify(req.body)}`);

    if (req.method == "POST") {
      const destUrl = `${UNDERLYING_URL}${req.path}`;
      const response = await axios.post(destUrl, req.body);
      console.log(`[<--] ${response.status} ${JSON.stringify(response.data)}`);

      res.status(response.status).send(response.data);
    } else {
      res.status(405).send(`Unsupported method: ${req.method} is not allowed`);
    }

    /*
    const { url } = req.body;
    // Make a POST request to the proxied endpoint using Axios

    // Return the response from the proxied endpoint
    res.status(response.status).send(response.data);
     */
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

/*
const proxy = createProxyMiddleware({
  target: UNDERLYING_URL,
  changeOrigin: true, // for vhosted sites

  selfHandleResponse: true, // res.end() will be called internally by responseInterceptor()

  onProxyReq: (proxyReq: ClientRequest, req, res, options) => {
    const exchange = `[-->] ${req.method} ${req.url} -> ${proxyReq.method} ${proxyReq.host} ${proxyReq.path}`;
    console.log(exchange);

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      console.log(body);

      // Modify the body of the request here
      // const modifiedBody = body; // JSON.stringify({ data: body });
      // proxyReq.setHeader('content-type', 'application/json');
      // proxyReq.setHeader('content-length', Buffer.byteLength(modifiedBody));
      // proxyReq.write(modifiedBody);
      // proxyReq.end();
    });
  },

  onProxyRes: responseInterceptor(
    async (responseBuffer, proxyRes, req, res) => {
      // log original request and proxied request info
      const exchange = `[<--] ${req.method} ${req.url} -> ${proxyRes.url} [${proxyRes.statusCode}]`;
      console.log(exchange); // [DEBUG] GET / -> http://www.example.com [200]

      // log complete response
      const response = responseBuffer.toString("utf8");
      console.log(response); // log response body

      return responseBuffer;
    }
  ),
});

const app = express();

app.use("/", proxy);
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded());

app.listen(8080);
*/

/*
import * as http from "http";
import * as https from "https";

const server = http.createServer(
  (req: http.IncomingMessage, res: http.ServerResponse) => {
    const { method, url, headers } = req;
    console.log(`${method} request to ${url}`);

    const underlyingRpc = "https://eth.llamarpc.com"

    const proxy = https.request(
      new URL(url!, underlyingRpc),
      { method, headers },
      (proxyRes: http.IncomingMessage) => {
        console.log(`Proxy response status code: ${proxyRes.statusCode}`);
        // res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        // proxyRes.pipe(res);
      }
    );

    req.pipe(proxy);
  }
);

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
*/

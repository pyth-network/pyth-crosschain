import * as http from "http";

const server = http.createServer(
  (req: http.IncomingMessage, res: http.ServerResponse) => {
    const { method, url, headers } = req;
    console.log(`${method} request to ${url}`);

    const proxy = http.request(
      url!,
      { method, headers },
      (proxyRes: http.IncomingMessage) => {
        console.log(`Proxy response status code: ${proxyRes.statusCode}`);
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    req.pipe(proxy);
  }
);

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});

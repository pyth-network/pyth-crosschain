/* global self */
self.onmessage = async (evt) => {
  if (!evt.data || evt.data.cmd !== "start") return;
  const token = evt.data.token;
  const urls = evt.data.urls;

  self.postMessage({ type: "env", isNode: typeof process !== "undefined" && !!process.versions?.node, hasWebSocket: typeof self.WebSocket !== "undefined" });

  try {
    const OrigWS = self.WebSocket;
    self.WebSocket = function(url, protocols) {
      try { self.postMessage({ type: "ws_url", url: String(url) }); } catch {}
      return new OrigWS(url, protocols);
    };
    for (const k of ["CONNECTING","OPEN","CLOSING","CLOSED"]) {
      if (k in OrigWS) self.WebSocket[k] = OrigWS[k];
    }

    let mod;
    try {
      mod = await import("./dist/esm/index.js");
    } catch {
      mod = await import("./sdk/index.js");
    }
    const { PythLazerClient } = mod;

    const logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const client = await PythLazerClient.create({
      urls,
      token,
      numConnections: 1,
      logger,
      onError: (e) => self.postMessage({ type: "error", error: String(e) }),
    });

    client.addMessageListener((msg) => {
      self.postMessage({ type: "msg", msgType: typeof msg, sample: typeof msg === "string" ? msg.slice(0, 100) : "binary" });
    });

    self.postMessage({ type: "ready" });

    setTimeout(() => {
      client.close();
      self.postMessage({ type: "done" });
    }, 8000);
  } catch (e) {
    self.postMessage({ type: "error", error: String(e), stack: e && e.stack ? String(e.stack) : undefined });
  }
};

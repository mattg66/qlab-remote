import { createServer } from "http";
import next from "next";
import { attachQLabWebSocketServer } from "./lib/ws/server";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  attachQLabWebSocketServer(httpServer);

  httpServer.listen(port, () => {
    console.log(`> QLab Cue Cart Remote ready on http://localhost:${port}`);
  });
});

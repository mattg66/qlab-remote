import type { Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { getQLabConnection } from "../qlab/connection";
import type { ClientMessage, QLabState, ServerMessage } from "../qlab/types";

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseClientMessage(raw: unknown): ClientMessage | null {
  if (typeof raw !== "string") return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.type === "trigger" && typeof parsed.cueId === "string") {
      return parsed as ClientMessage;
    }
  } catch {
    // Ignore malformed messages from the browser.
  }

  return null;
}

/**
 * Attaches a WebSocket server to the given HTTP server. Each connected
 * browser receives the current QLab state immediately and live updates
 * thereafter; "trigger" messages from the browser are forwarded to QLab.
 */
export function attachQLabWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const connection = getQLabConnection();

  const broadcast = (state: QLabState) => {
    const message: ServerMessage = { type: "state", state };
    for (const client of wss.clients) {
      send(client, message);
    }
  };

  connection.on("state", broadcast);

  wss.on("connection", (socket) => {
    send(socket, { type: "state", state: connection.getState() });

    socket.on("message", (raw) => {
      const message = parseClientMessage(raw.toString());
      if (message?.type === "trigger") {
        connection.triggerCue(message.cueId);
      }
    });
  });

  return wss;
}

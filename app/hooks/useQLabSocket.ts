"use client";

import { useEffect, useRef, useState } from "react";
import {
  initialQLabState,
  type ClientMessage,
  type QLabState,
  type ServerMessage,
} from "@/lib/qlab/types";

const RECONNECT_DELAY_MS = 2000;

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

/**
 * Connects to the server's /ws endpoint, mirrors the latest QLabState
 * into React state, and exposes a `trigger` function for sending cue
 * commands back to the server. Reconnects automatically if the socket drops
 * (e.g. on a server restart) — independent from the server's own QLab
 * reconnect logic.
 */
export function useQLabSocket() {
  const [state, setState] = useState<QLabState>(initialQLabState);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;

      const socket = new WebSocket(socketUrl());
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          if (message.type === "state") {
            setState(message.state);
          }
        } catch {
          // Ignore malformed messages from the server.
        }
      };

      socket.onclose = () => {
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
    };
  }, []);

  const send = (message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const trigger = (cueId: string) => send({ type: "trigger", cueId });
  const stop = (cueId: string) => send({ type: "stop", cueId });
  const stopAll = () => send({ type: "stopAll" });

  return { state, trigger, stop, stopAll };
}

import { TCPSocketPort, type OscMessage, type OscArgument } from "osc";

export interface PendingReply {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface QLabReply {
  workspace_id?: string;
  address: string;
  status: "ok" | "error" | "denied";
  data?: unknown;
}

const REPLY_TIMEOUT_MS = 5000;

export const oscString = (value: string): OscArgument => ({ type: "s", value });
export const oscInt = (value: number): OscArgument => ({ type: "i", value });

/**
 * Thin wrapper around osc.js's SLIP-framed TCP port that adds
 * request/reply correlation by OSC address, since QLab echoes the
 * original address back in its JSON reply payload.
 */
export class QLabOscClient {
  private port: TCPSocketPort | null = null;
  private pending = new Map<string, PendingReply[]>();

  constructor(
    private readonly host: string,
    private readonly port_: number,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const port = new TCPSocketPort({
        address: this.host,
        port: this.port_,
        metadata: true,
      });

      const onReady = () => {
        port.removeListener("error", onInitialError);
        resolve();
      };
      const onInitialError = (err: Error) => {
        port.removeListener("ready", onReady);
        reject(err);
      };

      port.once("ready", onReady);
      port.once("error", onInitialError);
      port.on("message", this.handleMessage);

      this.port = port;
      port.open();
    });
  }

  onMessage(listener: (message: OscMessage) => void): void {
    this.port?.on("message", listener);
  }

  onError(listener: (error: Error) => void): void {
    this.port?.on("error", listener);
  }

  onClose(listener: () => void): void {
    this.port?.on("close", listener);
  }

  close(): void {
    this.port?.close();
    this.port = null;
    this.rejectAllPending(new Error("OSC connection closed"));
  }

  /** Sends an OSC message and resolves with QLab's JSON reply for that address. */
  request(address: string, args: OscArgument[] = []): Promise<unknown> {
    if (!this.port) {
      return Promise.reject(new Error("OSC client is not connected"));
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.removePending(address, entry);
        reject(new Error(`Timed out waiting for reply to ${address}`));
      }, REPLY_TIMEOUT_MS);

      const entry: PendingReply = { resolve, reject, timeout };
      const queue = this.pending.get(address) ?? [];
      queue.push(entry);
      this.pending.set(address, queue);

      this.port!.send({ address, args });
    });
  }

  /** Sends an OSC message without waiting for a reply. */
  send(address: string, args: OscArgument[] = []): void {
    this.port?.send({ address, args });
  }

  private handleMessage = (message: OscMessage): void => {
    const reply = parseReply(message);
    if (!reply) {
      return;
    }

    const queue = this.pending.get(reply.address);
    if (!queue || queue.length === 0) {
      return;
    }

    const entry = queue.shift()!;
    if (queue.length === 0) {
      this.pending.delete(reply.address);
    }
    clearTimeout(entry.timeout);

    if (reply.status === "ok") {
      entry.resolve(reply.data);
    } else {
      entry.reject(new Error(`QLab returned "${reply.status}" for ${reply.address}`));
    }
  };

  private removePending(address: string, entry: PendingReply): void {
    const queue = this.pending.get(address);
    if (!queue) return;
    const idx = queue.indexOf(entry);
    if (idx !== -1) queue.splice(idx, 1);
    if (queue.length === 0) this.pending.delete(address);
  }

  private rejectAllPending(error: Error): void {
    for (const queue of this.pending.values()) {
      for (const entry of queue) {
        clearTimeout(entry.timeout);
        entry.reject(error);
      }
    }
    this.pending.clear();
  }
}

/**
 * QLab's JSON reply arrives as the single string argument of an OSC
 * message whose address mirrors the request (e.g. "/reply/workspace/.../cueLists").
 * The reply body identifies the original address it answers via "address".
 */
function parseReply(message: OscMessage): QLabReply | null {
  const [arg] = message.args;
  const raw = extractStringValue(arg);
  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as QLabReply;
    if (typeof parsed.address === "string" && typeof parsed.status === "string") {
      return parsed;
    }
  } catch {
    // Not a JSON reply (e.g. plain "/thump" pong) — ignore.
  }

  return null;
}

function extractStringValue(arg: unknown): string | null {
  if (typeof arg === "string") {
    return arg;
  }
  if (
    arg &&
    typeof arg === "object" &&
    "value" in arg &&
    typeof (arg as { value: unknown }).value === "string"
  ) {
    return (arg as { value: string }).value;
  }
  return null;
}

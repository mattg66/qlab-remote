declare module "osc" {
  import { EventEmitter } from "events";

  export interface OscArgument {
    type: string;
    value: unknown;
  }

  export interface OscMessage {
    address: string;
    args: unknown[];
  }

  export interface TCPSocketPortOptions {
    address: string;
    port: number;
    useSLIP?: boolean;
    metadata?: boolean;
  }

  export class TCPSocketPort extends EventEmitter {
    constructor(options: TCPSocketPortOptions);
    open(): void;
    close(): void;
    send(message: { address: string; args?: unknown[] }): void;

    on(event: "ready", listener: () => void): this;
    on(event: "message", listener: (message: OscMessage) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    on(event: "close", listener: (hadError?: boolean) => void): this;
  }
}

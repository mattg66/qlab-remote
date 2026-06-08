import { EventEmitter } from "events";
import { QLabOscClient } from "./osc-client";
import {
  initialQLabState,
  type QLabCart,
  type QLabCue,
  type QLabState,
} from "./types";

interface QLabConfig {
  host: string;
  port: number;
  passcode: string;
  workspaceId: string;
}

interface RawCueDictionary {
  uniqueID: string;
  number?: string;
  name?: string;
  listName?: string;
  type?: string;
  colorName?: string;
  flagged?: boolean;
  armed?: boolean;
  cues?: RawCueDictionary[];
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 250;

function readConfig(): QLabConfig {
  return {
    host: process.env.QLAB_HOST ?? "127.0.0.1",
    port: Number(process.env.QLAB_PORT ?? 53000),
    passcode: process.env.QLAB_PASSCODE ?? "",
    workspaceId: process.env.QLAB_WORKSPACE_ID ?? "",
  };
}

/**
 * Owns a single persistent OSC/TCP connection to a QLab workspace,
 * keeps an in-memory snapshot of its Cue Carts, and emits "state"
 * whenever that snapshot changes. Reconnects with backoff on failure.
 */
export class QLabConnection extends EventEmitter {
  private config = readConfig();
  private client: QLabOscClient | null = null;
  private state: QLabState = { ...initialQLabState };
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  start(): void {
    this.closed = false;
    void this.connectOnce();
  }

  stop(): void {
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.client?.close();
    this.client = null;
  }

  getState(): QLabState {
    return this.state;
  }

  /** Triggers a cue (typically a cart cue) by its uniqueID via /cue_id/{id}/start. */
  triggerCue(cueId: string): void {
    if (this.state.status !== "connected" || !this.client) {
      return;
    }
    this.client.send(`/cue_id/${cueId}/start`);
  }

  private async connectOnce(): Promise<void> {
    if (this.closed) return;

    if (!this.config.workspaceId) {
      this.setState({
        status: "disconnected",
        message: "QLAB_WORKSPACE_ID is not configured",
      });
      return;
    }

    this.setState({ status: "connecting", message: null });

    const client = new QLabOscClient(this.config.host, this.config.port);
    this.client = client;

    try {
      await client.connect();
      client.onError(this.handleTransportError);
      client.onClose(this.handleTransportClose);

      await this.authenticate(client);
      await client.request(`/workspace/${this.config.workspaceId}/updates`, [1]);
      this.subscribeToUpdates(client);

      await this.refreshCarts();

      this.reconnectAttempt = 0;
      this.setState({ status: "connected", workspaceId: this.config.workspaceId, message: null });
    } catch (err) {
      this.handleConnectFailure(err as Error);
    }
  }

  private async authenticate(client: QLabOscClient): Promise<void> {
    const args = this.config.passcode ? [this.config.passcode] : [];
    await client.request(`/workspace/${this.config.workspaceId}/connect`, args);
  }

  /**
   * QLab pushes "/update/workspace/{id}/..." pings when something changes.
   * We don't need to parse which cue changed — just debounce a full refresh.
   */
  private subscribeToUpdates(client: QLabOscClient): void {
    const updatePrefix = `/update/workspace/${this.config.workspaceId}`;
    client.onMessage((message) => {
      if (message.address.startsWith(updatePrefix)) {
        this.scheduleRefresh();
      }
    });
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) return;
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      void this.refreshCarts();
    }, REFRESH_DEBOUNCE_MS);
  }

  private async refreshCarts(): Promise<void> {
    const client = this.client;
    if (!client) return;

    const [cueLists, runningOrPaused] = await Promise.all([
      client.request(`/workspace/${this.config.workspaceId}/cueLists`),
      client.request(`/workspace/${this.config.workspaceId}/runningOrPausedCues`),
    ]);

    const runningIds = new Set<string>();
    for (const cue of asCueArray(runningOrPaused)) {
      if (cue.uniqueID !== undefined) {
        runningIds.add(cue.uniqueID);
      }
    }

    const carts = extractCarts(asCueArray(cueLists), runningIds);

    this.setState({ carts });
  }

  private handleConnectFailure(err: Error): void {
    this.client?.close();
    this.client = null;
    this.setState({ status: "disconnected", message: err.message });
    this.scheduleReconnect();
  }

  private handleTransportError = (err: Error): void => {
    this.setState({ message: err.message });
  };

  private handleTransportClose = (): void => {
    if (this.closed) return;
    this.client = null;
    this.setState({ status: "disconnected", message: "Connection to QLab closed" });
    this.scheduleReconnect();
  };

  private scheduleReconnect(): void {
    if (this.closed || this.reconnectTimer) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** this.reconnectAttempt,
      RECONNECT_MAX_DELAY_MS,
    );
    this.reconnectAttempt += 1;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectOnce();
    }, delay);
  }

  private setState(patch: Partial<QLabState>): void {
    this.state = { ...this.state, ...patch };
    this.emit("state", this.state);
  }
}

function asCueArray(data: unknown): RawCueDictionary[] {
  return Array.isArray(data) ? (data as RawCueDictionary[]) : [];
}

/** Walks the cueLists tree and collects every cue list/group of type "Cart". */
function extractCarts(roots: RawCueDictionary[], runningIds: Set<string>): QLabCart[] {
  const carts: QLabCart[] = [];

  for (const node of roots) {
    if (node.type === "Cart") {
      carts.push({
        uniqueID: node.uniqueID,
        name: node.name ?? node.listName ?? "Cart",
        number: node.number ?? "",
        cues: (node.cues ?? []).map((cue) => toQLabCue(cue, runningIds)),
      });
    }

    if (node.cues?.length) {
      carts.push(...extractCarts(node.cues, runningIds));
    }
  }

  return carts;
}

function toQLabCue(cue: RawCueDictionary, runningIds: Set<string>): QLabCue {
  return {
    uniqueID: cue.uniqueID,
    number: cue.number ?? "",
    name: cue.name ?? "",
    listName: cue.listName ?? "",
    type: cue.type ?? "",
    colorName: cue.colorName ?? "none",
    flagged: Boolean(cue.flagged),
    armed: cue.armed ?? true,
    isRunning: runningIds.has(cue.uniqueID),
  };
}

let singleton: QLabConnection | null = null;

export function getQLabConnection(): QLabConnection {
  if (!singleton) {
    singleton = new QLabConnection();
    singleton.start();
  }
  return singleton;
}

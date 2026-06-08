export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface QLabCue {
  uniqueID: string;
  number: string;
  name: string;
  listName: string;
  type: string;
  colorName: string;
  flagged: boolean;
  armed: boolean;
  isRunning: boolean;
}

export interface QLabCart {
  uniqueID: string;
  name: string;
  number: string;
  cues: QLabCue[];
}

export interface QLabState {
  status: ConnectionStatus;
  /** Present once a workspace connection has been established. */
  workspaceId: string | null;
  carts: QLabCart[];
  /** Human-readable error/info message for display alongside status. */
  message: string | null;
}

export const initialQLabState: QLabState = {
  status: "disconnected",
  workspaceId: null,
  carts: [],
  message: null,
};

/** Messages sent from the browser to the server over the WebSocket. */
export type ClientMessage = { type: "trigger"; cueId: string };

/** Messages sent from the server to the browser over the WebSocket. */
export type ServerMessage = { type: "state"; state: QLabState };

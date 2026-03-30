export interface SyncPayload<TState = unknown> {
  type: 'sync';
  state: TState;
}

export interface PresencePayload {
  type: 'presence';
  peers: string[];
}

export type SyncMessage<TState = unknown> =
  | SyncPayload<TState>
  | PresencePayload;

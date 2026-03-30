export interface SyncPayload<TState = unknown> {
  type: 'sync';
  state: TState;
}

export interface InitialStatePayload<TState = unknown> {
  type: 'initial-state';
  state: TState | null;
}

export interface PresencePayload {
  type: 'presence';
  peers: string[];
}

export type SyncMessage<TState = unknown> =
  | SyncPayload<TState>
  | InitialStatePayload<TState>
  | PresencePayload;

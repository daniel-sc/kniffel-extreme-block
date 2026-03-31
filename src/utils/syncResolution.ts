import type { GameState } from '@/types/game';

export interface SyncConflictState {
  localState: GameState;
  serverState: GameState;
  lastSyncedAt: string | null;
}

const ensureRevision = (state: GameState): GameState => {
  if (state.updatedAt) return state;
  return { ...state, updatedAt: new Date().toISOString() };
};

export const areGameStatesEqual = (left: GameState, right: GameState): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

// --- Initial state resolution (3-way merge) ---

export type InitialStateResolution =
  | {
      ready: true;
      applyState?: GameState;
      suppressBroadcast: boolean;
      newLastSyncedAt?: string | null;
    }
  | {
      ready: false;
      conflict: SyncConflictState;
    };

export function resolveInitialState(params: {
  localState: GameState;
  remoteState: GameState | null;
  lastSyncedAt: string | null;
  isPristine: boolean;
  replaceLocalState: boolean;
}): InitialStateResolution {
  const { localState, remoteState, lastSyncedAt, isPristine, replaceLocalState } = params;

  if (replaceLocalState) {
    if (remoteState === null) {
      return { ready: true, suppressBroadcast: false, newLastSyncedAt: null };
    }
    const normalized = ensureRevision(remoteState);
    return {
      ready: true,
      applyState: normalized,
      suppressBroadcast: true,
      newLastSyncedAt: normalized.updatedAt,
    };
  }

  if (remoteState === null) {
    return { ready: true, suppressBroadcast: false };
  }

  const normalized = ensureRevision(remoteState);
  const localRevision = localState.updatedAt;
  const serverRevision = normalized.updatedAt;

  if (localRevision === serverRevision) {
    const needsApply = !areGameStatesEqual(localState, normalized);
    return {
      ready: true,
      applyState: needsApply ? normalized : undefined,
      suppressBroadcast: true,
      newLastSyncedAt: serverRevision,
    };
  }

  if (lastSyncedAt && lastSyncedAt === serverRevision && localRevision !== lastSyncedAt) {
    return { ready: true, suppressBroadcast: false };
  }

  if (lastSyncedAt && lastSyncedAt === localRevision && serverRevision !== lastSyncedAt) {
    const needsApply = !areGameStatesEqual(localState, normalized);
    return {
      ready: true,
      applyState: needsApply ? normalized : undefined,
      suppressBroadcast: true,
      newLastSyncedAt: serverRevision,
    };
  }

  if (!lastSyncedAt && isPristine) {
    const needsApply = !areGameStatesEqual(localState, normalized);
    return {
      ready: true,
      applyState: needsApply ? normalized : undefined,
      suppressBroadcast: true,
      newLastSyncedAt: serverRevision,
    };
  }

  return {
    ready: false,
    conflict: { localState, serverState: normalized, lastSyncedAt },
  };
}

// --- Remote update resolution ---

export type RemoteUpdateResolution =
  | { action: 'apply'; state: GameState; lastSyncedAt: string }
  | { action: 'update-conflict'; serverState: GameState }
  | { action: 'mark-synced'; lastSyncedAt: string }
  | { action: 'ignore' };

export function resolveRemoteUpdate(params: {
  localState: GameState;
  remoteState: GameState;
  activeConflict: SyncConflictState | null;
}): RemoteUpdateResolution {
  const normalized = ensureRevision(params.remoteState);

  if (params.activeConflict) {
    if (areGameStatesEqual(params.activeConflict.serverState, normalized)) {
      return { action: 'ignore' };
    }
    return { action: 'update-conflict', serverState: normalized };
  }

  if (areGameStatesEqual(params.localState, normalized)) {
    return { action: 'mark-synced', lastSyncedAt: normalized.updatedAt };
  }

  return { action: 'apply', state: normalized, lastSyncedAt: normalized.updatedAt };
}

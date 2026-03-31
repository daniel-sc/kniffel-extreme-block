import { useCallback, useEffect, useRef } from 'react';
import PartySocket from 'partysocket';
import { GameState } from '@/types/game';
import { SyncMessage } from '@/types/sync';
import {
  useGameStore,
  readStoredLastSyncedAt,
  consumeBroadcastSuppression,
} from '@/store/gameStore';
import { resolveInitialState, resolveRemoteUpdate } from '@/utils/syncResolution';

const ROOM_PARAM_KEY = 'room';
const DEFAULT_PARTY_NAME = 'kniffel-sync';

interface InitialStateContext {
  replaceLocalState: boolean;
  roomId: string;
}

const generateRoomId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `room-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const readStoredRoomId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kniffel-extreme-sync-room-id') || '';
};

const readSharedRoomId = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get(ROOM_PARAM_KEY)?.trim() || '';
};

const clearSharedRoomParam = () => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.delete(ROOM_PARAM_KEY);
  window.history.replaceState({}, '', url.toString());
};

const getSyncHost = () => {
  const configured = import.meta.env.VITE_SYNC_HOST ?? import.meta.env.VITE_PARTYKIT_HOST;
  if (configured && configured.trim().length > 0) return configured.trim();
  return window.location.host;
};

const getPartyName = () => {
  const configured = import.meta.env.VITE_SYNC_PARTY ?? import.meta.env.VITE_PARTYKIT_PARTY;
  return configured?.trim() || DEFAULT_PARTY_NAME;
};

export const usePeerSync = () => {
  const socketRef = useRef<PartySocket | null>(null);
  const hasReceivedInitialStateRef = useRef(false);
  const initialStateContextRef = useRef<InitialStateContext>({
    replaceLocalState: false,
    roomId: '',
  });
  const pendingReplaceLocalStateRef = useRef(false);

  const store = useGameStore;

  // --- Socket helpers ---

  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    hasReceivedInitialStateRef.current = false;
    store.getState().resetSyncConnection();
  }, [store]);

  // --- Message handlers ---

  const handleInitialStateMessage = useCallback(
    (remoteState: GameState | null, context: InitialStateContext) => {
      const s = store.getState();
      const result = resolveInitialState({
        localState: s.gameState,
        remoteState,
        lastSyncedAt: readStoredLastSyncedAt(context.roomId),
        isPristine: s.isPristineLocalState,
        replaceLocalState: context.replaceLocalState,
      });

      if (!result.ready) {
        s.setSyncConflict(result.conflict);
        return false;
      }

      s.applyInitialStateResolution(result, context.replaceLocalState && remoteState === null);
      return true;
    },
    [store],
  );

  const handleSyncMessage = useCallback(
    (remoteState: GameState) => {
      const s = store.getState();
      const result = resolveRemoteUpdate({
        localState: s.gameState,
        remoteState,
        activeConflict: s.syncConflict,
      });

      switch (result.action) {
        case 'apply':
          s.applyRemoteSync(result.state, result.lastSyncedAt);
          break;
        case 'update-conflict':
          s.updateConflictServerState(result.serverState);
          break;
        case 'mark-synced':
          s.markLastSyncedAt(result.lastSyncedAt);
          break;
        case 'ignore':
          break;
      }
    },
    [store],
  );

  // --- Connection ---

  const connectToRoom = useCallback(
    async (targetRoomId: string, options?: { replaceLocalState?: boolean }) => {
      const nextRoomId = targetRoomId.trim();
      if (!nextRoomId) {
        throw new Error('Bitte eine gültige Raum-ID eingeben.');
      }

      const s = store.getState();
      if (
        socketRef.current &&
        socketRef.current.room === nextRoomId &&
        s.connectionStatus === 'connected'
      ) {
        return;
      }

      if (options?.replaceLocalState) {
        pendingReplaceLocalStateRef.current = true;
      }

      initialStateContextRef.current = {
        replaceLocalState: pendingReplaceLocalStateRef.current,
        roomId: nextRoomId,
      };

      closeSocket();
      store.getState().beginRoomConnection(nextRoomId);
      hasReceivedInitialStateRef.current = false;

      await new Promise<void>((resolve, reject) => {
        let isSettled = false;

        const timeout = window.setTimeout(() => {
          if (isSettled) return;
          isSettled = true;
          socket.close();
          if (socketRef.current === socket) socketRef.current = null;
          store.getState().resetSyncConnection();
          reject(new Error('Verbindungs-Timeout zum Raum.'));
        }, 10000);

        const socket = new PartySocket({
          host: getSyncHost(),
          room: nextRoomId,
          party: getPartyName(),
        });

        socketRef.current = socket;

        socket.addEventListener('open', () => {
          if (socketRef.current !== socket || store.getState().syncMode !== 'sync') return;
          window.clearTimeout(timeout);
          store.getState().setConnectionStatus('connected');
          if (!isSettled) {
            isSettled = true;
            resolve();
          }
        });

        socket.addEventListener('message', (event) => {
          if (socketRef.current !== socket || store.getState().syncMode !== 'sync') return;
          try {
            const message = JSON.parse(String(event.data)) as SyncMessage<GameState>;

            if (message.type === 'initial-state') {
              hasReceivedInitialStateRef.current = true;
              const context =
                initialStateContextRef.current.roomId === nextRoomId
                  ? initialStateContextRef.current
                  : { replaceLocalState: false, roomId: nextRoomId };
              handleInitialStateMessage(message.state, context);
              pendingReplaceLocalStateRef.current = false;
              initialStateContextRef.current = { replaceLocalState: false, roomId: nextRoomId };
            }

            if (message.type === 'sync' && hasReceivedInitialStateRef.current) {
              handleSyncMessage(message.state);
            }

            if (message.type === 'presence') {
              store.getState().setConnectedPeers(message.peers);
            }
          } catch (error) {
            console.warn('Invalid sync message:', error);
          }
        });

        socket.addEventListener('close', () => {
          if (socketRef.current !== socket) return;
          store.getState().resetSyncConnection();
        });

        socket.addEventListener('error', () => {
          if (socketRef.current !== socket) return;
          window.clearTimeout(timeout);
          if (!isSettled) {
            isSettled = true;
            socket.close();
            if (socketRef.current === socket) socketRef.current = null;
            store.getState().resetSyncConnection();
            reject(new Error('Fehler beim Verbinden mit dem Raum.'));
          }
        });
      });
    },
    [closeSocket, handleInitialStateMessage, handleSyncMessage, store],
  );

  // --- Startup ---

  useEffect(() => {
    const sharedRoomId = readSharedRoomId();
    const storedRoomId = readStoredRoomId();
    const initialRoomId = sharedRoomId || storedRoomId || generateRoomId();

    if (sharedRoomId) {
      pendingReplaceLocalStateRef.current = true;
      clearSharedRoomParam();
    }

    store.getState().updateRoom(initialRoomId);

    if (store.getState().syncMode === 'sync') {
      void connectToRoom(initialRoomId, {
        replaceLocalState: Boolean(sharedRoomId),
      }).catch((error) => {
        console.error('Unable to connect to sync room:', error);
      });
    }

    return () => closeSocket();
  }, [closeSocket, connectToRoom, store]);

  // --- Broadcast game state changes ---

  const broadcastState = useCallback(
    (state: GameState) => {
      const socket = socketRef.current;
      const { isSyncReady, syncMode } = store.getState();
      if (
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        !isSyncReady ||
        syncMode !== 'sync'
      ) {
        return false;
      }
      socket.send(JSON.stringify({ type: 'sync', state } satisfies SyncMessage));
      store.getState().markLastSyncedAt(state.updatedAt);
      return true;
    },
    [store],
  );

  const gameState = useGameStore((s) => s.gameState);
  const isSyncReady = useGameStore((s) => s.isSyncReady);

  useEffect(() => {
    if (!isSyncReady) return;
    if (consumeBroadcastSuppression()) return;
    broadcastState(gameState);
  }, [gameState, isSyncReady, broadcastState]);

  // --- Public actions ---

  const connectToPeer = useCallback(
    (remotePeerId: string) => {
      store.getState().setSyncConflict(null);
      return connectToRoom(remotePeerId, { replaceLocalState: true });
    },
    [connectToRoom, store],
  );

  const resetPeerId = useCallback(() => {
    const newRoomId = generateRoomId();
    if (store.getState().syncMode === 'sync') {
      void connectToRoom(newRoomId).catch((error) => {
        console.error('Unable to create a new room:', error);
      });
      return;
    }
    store.getState().updateRoom(newRoomId);
    closeSocket();
  }, [closeSocket, connectToRoom, store]);

  const workOffline = useCallback(() => {
    store.getState().goOffline();
    closeSocket();
  }, [closeSocket, store]);

  const resumeSync = useCallback(async () => {
    store.getState().setSyncConflict(null);
    const targetRoomId = store.getState().roomId || readStoredRoomId() || generateRoomId();
    await connectToRoom(targetRoomId);
  }, [connectToRoom, store]);

  return { connectToPeer, resetPeerId, workOffline, resumeSync };
};

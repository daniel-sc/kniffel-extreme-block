import { useCallback, useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { GameState } from '@/types/game';
import { SyncMessage } from '@/types/sync';
import {
  useGameStore,
  createInitialGameState,
  suppressBroadcastOnce,
  consumeBroadcastSuppression,
} from '@/store/gameStore';
import { resolveInitialState, resolveRemoteUpdate } from '@/utils/syncResolution';

const ROOM_ID_STORAGE_KEY = 'kniffel-extreme-sync-room-id';
const SYNC_MODE_STORAGE_KEY = 'kniffel-extreme-sync-mode';
const LAST_SYNCED_AT_STORAGE_PREFIX = 'kniffel-extreme-sync-last-synced-at';
const ROOM_PARAM_KEY = 'room';
const DEFAULT_PARTY_NAME = 'kniffel-sync';

type SyncMode = 'sync' | 'offline';
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

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
  return localStorage.getItem(ROOM_ID_STORAGE_KEY) || '';
};

const storeRoomId = (roomId: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ROOM_ID_STORAGE_KEY, roomId);
};

const readStoredSyncMode = (): SyncMode => {
  if (typeof window === 'undefined') return 'sync';
  return localStorage.getItem(SYNC_MODE_STORAGE_KEY) === 'offline' ? 'offline' : 'sync';
};

const storeSyncMode = (syncMode: SyncMode) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SYNC_MODE_STORAGE_KEY, syncMode);
};

const getLastSyncedAtStorageKey = (roomId: string) =>
  `${LAST_SYNCED_AT_STORAGE_PREFIX}:${roomId}`;

const readStoredLastSyncedAt = (roomId: string) => {
  if (typeof window === 'undefined' || !roomId) return null;
  return localStorage.getItem(getLastSyncedAtStorageKey(roomId));
};

const storeLastSyncedAt = (roomId: string, updatedAt: string | null) => {
  if (typeof window === 'undefined' || !roomId) return;
  const key = getLastSyncedAtStorageKey(roomId);
  if (updatedAt) {
    localStorage.setItem(key, updatedAt);
  } else {
    localStorage.removeItem(key);
  }
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
  const [roomId, setRoomId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [syncMode, setSyncMode] = useState<SyncMode>(() => readStoredSyncMode());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const socketRef = useRef<PartySocket | null>(null);
  const roomIdRef = useRef(roomId);
  const syncModeRef = useRef(syncMode);
  const connectionStatusRef = useRef(connectionStatus);
  const isSyncReadyRef = useRef(isSyncReady);
  const hasReceivedInitialStateRef = useRef(false);
  const initialStateContextRef = useRef<InitialStateContext>({
    replaceLocalState: false,
    roomId: '',
  });
  const pendingReplaceLocalStateRef = useRef(false);

  roomIdRef.current = roomId;
  syncModeRef.current = syncMode;
  connectionStatusRef.current = connectionStatus;
  isSyncReadyRef.current = isSyncReady;

  const setSyncReadyBoth = useCallback((ready: boolean) => {
    isSyncReadyRef.current = ready;
    setIsSyncReady(ready);
  }, []);

  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    connectionStatusRef.current = status;
    setConnectionStatus(status);
  }, []);

  const markLastSyncedAt = useCallback((updatedAt: string | null) => {
    const currentRoomId = roomIdRef.current;
    if (currentRoomId) {
      storeLastSyncedAt(currentRoomId, updatedAt);
    }
    setLastSyncedAt(updatedAt);
  }, []);

  const updateRoom = useCallback((nextRoomId: string) => {
    roomIdRef.current = nextRoomId;
    setRoomId(nextRoomId);
    storeRoomId(nextRoomId);
    setLastSyncedAt(readStoredLastSyncedAt(nextRoomId));
  }, []);

  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    hasReceivedInitialStateRef.current = false;
    updateConnectionStatus('disconnected');
    setSyncReadyBoth(false);
    setConnectedPeers([]);
  }, [setSyncReadyBoth, updateConnectionStatus]);

  // --- Message handlers that read/write the store directly ---

  const handleInitialStateMessage = useCallback(
    (remoteState: GameState | null, context: InitialStateContext) => {
      const store = useGameStore.getState();
      const result = resolveInitialState({
        localState: store.gameState,
        remoteState,
        lastSyncedAt: readStoredLastSyncedAt(context.roomId),
        isPristine: store.isPristineLocalState,
        replaceLocalState: context.replaceLocalState,
      });

      if (!result.ready) {
        store.setSyncConflict(result.conflict);
        return false;
      }

      store.setSyncConflict(null);
      if (result.suppressBroadcast) suppressBroadcastOnce();
      if (result.newLastSyncedAt !== undefined) markLastSyncedAt(result.newLastSyncedAt);
      if (result.applyState) {
        store.applyRemoteState(result.applyState);
      } else if (context.replaceLocalState && remoteState === null) {
        store.applyRemoteState(createInitialGameState());
      }
      return true;
    },
    [markLastSyncedAt],
  );

  const handleSyncMessage = useCallback(
    (remoteState: GameState) => {
      const store = useGameStore.getState();
      const result = resolveRemoteUpdate({
        localState: store.gameState,
        remoteState,
        activeConflict: store.syncConflict,
      });

      switch (result.action) {
        case 'apply':
          suppressBroadcastOnce();
          markLastSyncedAt(result.lastSyncedAt);
          store.applyRemoteState(result.state);
          break;
        case 'update-conflict':
          store.updateConflictServerState(result.serverState);
          break;
        case 'mark-synced':
          markLastSyncedAt(result.lastSyncedAt);
          break;
        case 'ignore':
          break;
      }
    },
    [markLastSyncedAt],
  );

  // --- Connection ---

  const connectToRoom = useCallback(
    async (targetRoomId: string, options?: { replaceLocalState?: boolean }) => {
      const nextRoomId = targetRoomId.trim();
      if (!nextRoomId) {
        throw new Error('Bitte eine gültige Raum-ID eingeben.');
      }

      syncModeRef.current = 'sync';
      setSyncMode('sync');
      storeSyncMode('sync');

      if (
        socketRef.current &&
        socketRef.current.room === nextRoomId &&
        connectionStatusRef.current === 'connected'
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
      updateRoom(nextRoomId);
      updateConnectionStatus('connecting');
      hasReceivedInitialStateRef.current = false;
      setSyncReadyBoth(false);

      await new Promise<void>((resolve, reject) => {
        let isSettled = false;

        const timeout = window.setTimeout(() => {
          if (isSettled) return;
          isSettled = true;
          socket.close();
          if (socketRef.current === socket) socketRef.current = null;
          updateConnectionStatus('disconnected');
          reject(new Error('Verbindungs-Timeout zum Raum.'));
        }, 10000);

        const socket = new PartySocket({
          host: getSyncHost(),
          room: nextRoomId,
          party: getPartyName(),
        });

        socketRef.current = socket;

        socket.addEventListener('open', () => {
          if (socketRef.current !== socket || syncModeRef.current !== 'sync') return;
          window.clearTimeout(timeout);
          updateConnectionStatus('connected');
          setSyncReadyBoth(false);
          if (!isSettled) {
            isSettled = true;
            resolve();
          }
        });

        socket.addEventListener('message', (event) => {
          if (socketRef.current !== socket || syncModeRef.current !== 'sync') return;
          try {
            const message = JSON.parse(String(event.data)) as SyncMessage<GameState>;

            if (message.type === 'initial-state') {
              hasReceivedInitialStateRef.current = true;
              const context =
                initialStateContextRef.current.roomId === nextRoomId
                  ? initialStateContextRef.current
                  : { replaceLocalState: false, roomId: nextRoomId };
              const isReady = handleInitialStateMessage(message.state, context);
              pendingReplaceLocalStateRef.current = false;
              initialStateContextRef.current = { replaceLocalState: false, roomId: nextRoomId };
              setSyncReadyBoth(isReady);
            }

            if (message.type === 'sync' && hasReceivedInitialStateRef.current) {
              handleSyncMessage(message.state);
            }

            if (message.type === 'presence') {
              setConnectedPeers(message.peers);
            }
          } catch (error) {
            console.warn('Invalid sync message:', error);
          }
        });

        socket.addEventListener('close', () => {
          if (socketRef.current !== socket) return;
          updateConnectionStatus('disconnected');
          setSyncReadyBoth(false);
          setConnectedPeers([]);
        });

        socket.addEventListener('error', () => {
          if (socketRef.current !== socket) return;
          window.clearTimeout(timeout);
          if (!isSettled) {
            isSettled = true;
            socket.close();
            if (socketRef.current === socket) socketRef.current = null;
            updateConnectionStatus('disconnected');
            reject(new Error('Fehler beim Verbinden mit dem Raum.'));
          }
        });
      });
    },
    [
      closeSocket,
      handleInitialStateMessage,
      handleSyncMessage,
      setSyncReadyBoth,
      updateConnectionStatus,
      updateRoom,
    ],
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

    updateRoom(initialRoomId);

    if (syncModeRef.current === 'sync') {
      void connectToRoom(initialRoomId, {
        replaceLocalState: Boolean(sharedRoomId),
      }).catch((error) => {
        console.error('Unable to connect to sync room:', error);
      });
    }

    return () => closeSocket();
  }, [closeSocket, connectToRoom, updateRoom]);

  // --- Broadcast game state changes ---

  const broadcastState = useCallback(
    (state: GameState) => {
      const socket = socketRef.current;
      if (
        !socket ||
        socket.readyState !== WebSocket.OPEN ||
        !isSyncReadyRef.current ||
        syncModeRef.current !== 'sync'
      ) {
        return false;
      }
      socket.send(JSON.stringify({ type: 'sync', state } satisfies SyncMessage));
      markLastSyncedAt(state.updatedAt);
      return true;
    },
    [markLastSyncedAt],
  );

  const gameState = useGameStore((s) => s.gameState);

  useEffect(() => {
    if (!isSyncReady) return;
    if (consumeBroadcastSuppression()) return;
    broadcastState(gameState);
  }, [gameState, isSyncReady, broadcastState]);

  // --- Public actions ---

  const connectToPeer = useCallback(
    (remotePeerId: string) => {
      useGameStore.getState().setSyncConflict(null);
      return connectToRoom(remotePeerId, { replaceLocalState: true });
    },
    [connectToRoom],
  );

  const resetPeerId = useCallback(() => {
    const newRoomId = generateRoomId();
    if (syncModeRef.current === 'sync') {
      void connectToRoom(newRoomId).catch((error) => {
        console.error('Unable to create a new room:', error);
      });
      return;
    }
    updateRoom(newRoomId);
    closeSocket();
  }, [closeSocket, connectToRoom, updateRoom]);

  const workOffline = useCallback(() => {
    syncModeRef.current = 'offline';
    setSyncMode('offline');
    storeSyncMode('offline');
    closeSocket();
    useGameStore.getState().setSyncConflict(null);
  }, [closeSocket]);

  const resumeSync = useCallback(async () => {
    useGameStore.getState().setSyncConflict(null);
    const targetRoomId = roomIdRef.current || readStoredRoomId() || generateRoomId();
    await connectToRoom(targetRoomId);
  }, [connectToRoom]);

  return {
    peerId: roomId,
    connectedPeers,
    isConnecting: connectionStatus === 'connecting',
    isSyncReady,
    connectionStatus,
    syncMode,
    lastSyncedAt,
    connectToPeer,
    resetPeerId,
    broadcastState,
    setSyncReady: setSyncReadyBoth,
    markLastSyncedAt,
    workOffline,
    resumeSync,
  };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { GameState } from '@/types/game';
import { SyncMessage } from '@/types/sync';

const ROOM_ID_STORAGE_KEY = 'kniffel-extreme-sync-room-id';
const SYNC_MODE_STORAGE_KEY = 'kniffel-extreme-sync-mode';
const LAST_SYNCED_AT_STORAGE_PREFIX = 'kniffel-extreme-sync-last-synced-at';
const ROOM_PARAM_KEY = 'room';
const DEFAULT_PARTY_NAME = 'kniffel-sync';

type SyncMode = 'sync' | 'offline';
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface InitialStateContext {
  replaceLocalState: boolean;
  roomId: string;
}

interface ConnectToRoomOptions {
  replaceLocalState?: boolean;
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

const getLastSyncedAtStorageKey = (roomId: string) => `${LAST_SYNCED_AT_STORAGE_PREFIX}:${roomId}`;

const readStoredLastSyncedAt = (roomId: string) => {
  if (typeof window === 'undefined' || !roomId) return null;
  return localStorage.getItem(getLastSyncedAtStorageKey(roomId));
};

const storeLastSyncedAt = (roomId: string, updatedAt: string | null) => {
  if (typeof window === 'undefined' || !roomId) return;

  const storageKey = getLastSyncedAtStorageKey(roomId);
  if (updatedAt) {
    localStorage.setItem(storageKey, updatedAt);
    return;
  }

  localStorage.removeItem(storageKey);
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
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  return window.location.host;
};

const getPartyName = () => {
  const configured = import.meta.env.VITE_SYNC_PARTY ?? import.meta.env.VITE_PARTYKIT_PARTY;
  return configured?.trim() || DEFAULT_PARTY_NAME;
};

export const usePeerSync = (
  onInitialState: (state: GameState | null, context: InitialStateContext) => boolean,
  onRemoteUpdate: (state: GameState) => void,
): {
  peerId: string;
  connectedPeers: string[];
  isConnecting: boolean;
  isReconnecting: boolean;
  isSyncReady: boolean;
  connectionStatus: ConnectionStatus;
  syncMode: SyncMode;
  lastSyncedAt: string | null;
  connectToPeer: (remotePeerId: string) => Promise<void>;
  removePeer: () => void;
  resetPeerId: () => void;
  broadcastState: (state: GameState) => boolean;
  setSyncReady: (ready: boolean) => void;
  markLastSyncedAt: (updatedAt: string | null) => void;
  workOffline: () => void;
  resumeSync: () => Promise<void>;
} => {
  const [roomId, setRoomId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [syncMode, setSyncMode] = useState<SyncMode>(() => readStoredSyncMode());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const socketRef = useRef<PartySocket | null>(null);
  const onInitialStateRef = useRef(onInitialState);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
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

  onInitialStateRef.current = onInitialState;
  onRemoteUpdateRef.current = onRemoteUpdate;
  roomIdRef.current = roomId;
  syncModeRef.current = syncMode;
  connectionStatusRef.current = connectionStatus;
  isSyncReadyRef.current = isSyncReady;

  const setSyncReady = useCallback((ready: boolean) => {
    isSyncReadyRef.current = ready;
    setIsSyncReady(ready);
  }, []);

  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    connectionStatusRef.current = status;
    setConnectionStatus(status);
  }, []);

  const markLastSyncedAt = useCallback((updatedAt: string | null) => {
    const currentRoomId = roomIdRef.current;
    if (!currentRoomId) {
      setLastSyncedAt(updatedAt);
      return;
    }

    storeLastSyncedAt(currentRoomId, updatedAt);
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
    setSyncReady(false);
    setConnectedPeers([]);
  }, [setSyncReady, updateConnectionStatus]);

  const connectToRoom = useCallback(
    async (targetRoomId: string, options?: ConnectToRoomOptions) => {
      const nextRoomId = targetRoomId.trim();
      if (!nextRoomId) {
        throw new Error('Bitte eine gültige Raum-ID eingeben.');
      }

      syncModeRef.current = 'sync';
      setSyncMode('sync');
      storeSyncMode('sync');

      if (
        socketRef.current &&
        roomIdRef.current === nextRoomId &&
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
      setSyncReady(false);

      await new Promise<void>((resolve, reject) => {
        let isSettled = false;
        const timeout = window.setTimeout(() => {
          if (isSettled) {
            return;
          }

          isSettled = true;
          socket.close();
          if (socketRef.current === socket) {
            socketRef.current = null;
          }
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
          if (socketRef.current !== socket || syncModeRef.current !== 'sync') {
            return;
          }

          window.clearTimeout(timeout);
          updateConnectionStatus('connected');
          setSyncReady(false);

          if (!isSettled) {
            isSettled = true;
            resolve();
          }
        });

        socket.addEventListener('message', (event) => {
          if (socketRef.current !== socket || syncModeRef.current !== 'sync') {
            return;
          }

          try {
            const message = JSON.parse(String(event.data)) as SyncMessage<GameState>;
            if (message.type === 'initial-state') {
              hasReceivedInitialStateRef.current = true;
              const initialStateContext = initialStateContextRef.current.roomId === nextRoomId
                ? initialStateContextRef.current
                : { replaceLocalState: false, roomId: nextRoomId };
              const isReady = onInitialStateRef.current(message.state, initialStateContext);
              pendingReplaceLocalStateRef.current = false;
              initialStateContextRef.current = {
                replaceLocalState: false,
                roomId: nextRoomId,
              };
              setSyncReady(isReady);
            }

            if (message.type === 'sync' && hasReceivedInitialStateRef.current) {
              onRemoteUpdateRef.current(message.state);
            }

            if (message.type === 'presence') {
              setConnectedPeers(message.peers);
            }
          } catch (error) {
            console.warn('Invalid sync message:', error);
          }
        });

        socket.addEventListener('close', () => {
          if (socketRef.current !== socket) {
            return;
          }

          updateConnectionStatus('disconnected');
          setSyncReady(false);
          setConnectedPeers([]);
        });

        socket.addEventListener('error', () => {
          if (socketRef.current !== socket) {
            return;
          }

          window.clearTimeout(timeout);
          if (!isSettled) {
            isSettled = true;
            socket.close();
            if (socketRef.current === socket) {
              socketRef.current = null;
            }
            updateConnectionStatus('disconnected');
            reject(new Error('Fehler beim Verbinden mit dem Raum.'));
          }
        });
      });
    },
    [closeSocket, setSyncReady, updateConnectionStatus, updateRoom],
  );

  useEffect(() => {
    const sharedRoomId = readSharedRoomId();
    const storedRoomId = readStoredRoomId();
    const initialRoomId = sharedRoomId || storedRoomId || generateRoomId();

    if (sharedRoomId) {
      pendingReplaceLocalStateRef.current = true;
    }

    if (sharedRoomId) {
      clearSharedRoomParam();
    }

    updateRoom(initialRoomId);

    if (syncModeRef.current === 'sync') {
      void connectToRoom(initialRoomId, { replaceLocalState: Boolean(sharedRoomId) }).catch((error) => {
        console.error('Unable to connect to sync room:', error);
      });
    }

    return () => {
      closeSocket();
    };
  }, [closeSocket, connectToRoom, updateRoom]);

  const resetPeerId = useCallback(() => {
    const newRoomId = generateRoomId();
    updateRoom(newRoomId);

    if (syncModeRef.current === 'sync') {
      void connectToRoom(newRoomId).catch((error) => {
        console.error('Unable to create a new room:', error);
      });
      return;
    }

    closeSocket();
  }, [closeSocket, connectToRoom, updateRoom]);

  const workOffline = useCallback(() => {
    syncModeRef.current = 'offline';
    setSyncMode('offline');
    storeSyncMode('offline');
    closeSocket();
  }, [closeSocket]);

  const resumeSync = useCallback(async () => {
    const targetRoomId = roomIdRef.current || readStoredRoomId() || generateRoomId();
    await connectToRoom(targetRoomId);
  }, [connectToRoom]);

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

  return {
    peerId: roomId,
    connectedPeers,
    isConnecting: connectionStatus === 'connecting',
    isReconnecting: false,
    isSyncReady,
    connectionStatus,
    syncMode,
    lastSyncedAt,
    connectToPeer: (remotePeerId: string) => connectToRoom(remotePeerId, { replaceLocalState: true }),
    removePeer: () => {
      closeSocket();
    },
    resetPeerId,
    broadcastState,
    setSyncReady,
    markLastSyncedAt,
    workOffline,
    resumeSync,
  };
};

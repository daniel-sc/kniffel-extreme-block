import { useCallback, useEffect, useRef, useState } from 'react';
import PartySocket from 'partysocket';
import { GameState } from '@/types/game';
import { SyncMessage } from '@/types/sync';

const ROOM_ID_STORAGE_KEY = 'kniffel-extreme-sync-room-id';
const ROOM_PARAM_KEY = 'room';
const DEFAULT_PARTY_NAME = 'kniffel-sync';

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

const getPartyHost = () => {
  const configured = import.meta.env.VITE_PARTYKIT_HOST as string | undefined;
  if (configured && configured.trim().length > 0) {
    return configured.trim();
  }

  return window.location.host;
};

const getPartyName = () => {
  const configured = import.meta.env.VITE_PARTYKIT_PARTY as string | undefined;
  return configured?.trim() || DEFAULT_PARTY_NAME;
};

export const usePeerSync = (
  _gameState: GameState,
  onRemoteUpdate: (state: GameState) => void,
): {
  peerId: string;
  connectedPeers: string[];
  isConnecting: boolean;
  isReconnecting: boolean;
  connectToPeer: (remotePeerId: string) => Promise<void>;
  removePeer: () => void;
  resetPeerId: () => void;
  broadcastState: (state: GameState) => void;
} => {
  const [roomId, setRoomId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const socketRef = useRef<PartySocket | null>(null);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);

  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  }, [onRemoteUpdate]);

  const closeSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setConnectedPeers([]);
  }, []);

  const connectToRoom = useCallback(
    async (targetRoomId: string) => {
      const nextRoomId = targetRoomId.trim();
      if (!nextRoomId) {
        throw new Error('Bitte eine gültige Raum-ID eingeben.');
      }

      if (socketRef.current && roomId === nextRoomId && isConnected) {
        return;
      }

      closeSocket();
      setIsConnecting(true);
      setRoomId(nextRoomId);
      storeRoomId(nextRoomId);

      await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          setIsConnecting(false);
          reject(new Error('Verbindungs-Timeout zum Raum.'));
        }, 10000);

        const socket = new PartySocket({
          host: getPartyHost(),
          room: nextRoomId,
          party: getPartyName(),
        });

        socketRef.current = socket;

        socket.addEventListener('open', () => {
          window.clearTimeout(timeout);
          setIsConnecting(false);
          setIsConnected(true);
          socket.send(JSON.stringify({ type: 'request-sync' } satisfies SyncMessage));
          resolve();
        });

        socket.addEventListener('message', (event) => {
          try {
            const message = JSON.parse(String(event.data)) as SyncMessage;
            if (message.type === 'sync') {
              onRemoteUpdateRef.current(message.state);
            }
            if (message.type === 'presence') {
              setConnectedPeers(message.peers);
            }
          } catch (error) {
            console.warn('Invalid PartyKit message:', error);
          }
        });

        socket.addEventListener('close', () => {
          setIsConnected(false);
        });

        socket.addEventListener('error', () => {
          window.clearTimeout(timeout);
          setIsConnecting(false);
          reject(new Error('Fehler beim Verbinden mit dem Raum.'));
        });
      });
    },
    [closeSocket, isConnected, roomId],
  );

  useEffect(() => {
    const sharedRoomId = readSharedRoomId();
    const storedRoomId = readStoredRoomId();
    const initialRoomId = sharedRoomId || storedRoomId || generateRoomId();

    if (sharedRoomId) {
      clearSharedRoomParam();
    }

    void connectToRoom(initialRoomId).catch((error) => {
      console.error('Unable to connect to sync room:', error);
    });

    return () => {
      closeSocket();
    };
  }, [closeSocket, connectToRoom]);

  const resetPeerId = useCallback(() => {
    const newRoomId = generateRoomId();
    void connectToRoom(newRoomId).catch((error) => {
      console.error('Unable to create a new room:', error);
    });
  }, [connectToRoom]);

  const broadcastState = useCallback((state: GameState) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({ type: 'sync', state } satisfies SyncMessage));
  }, []);

  return {
    peerId: roomId,
    connectedPeers,
    isConnecting,
    isReconnecting: false,
    connectToPeer: connectToRoom,
    removePeer: () => {
      closeSocket();
    },
    resetPeerId,
    broadcastState,
  };
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { GameState } from '@/types/game';
import Peer, { DataConnection } from 'peerjs';

const PEER_ID_STORAGE_KEY = 'kniffel-extreme-peer-id';
const PEER_LIST_STORAGE_KEY = 'kniffel-extreme-peer-peers';

const uniquePeers = (peers: string[]) => Array.from(new Set(peers.filter(Boolean)));

const readStoredPeerId = () => localStorage.getItem(PEER_ID_STORAGE_KEY) || '';

const readStoredPeers = (): string[] => {
  try {
    const stored = localStorage.getItem(PEER_LIST_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return uniquePeers(parsed.filter((value) => typeof value === 'string'));
  } catch {
    return [];
  }
};

const storePeerId = (id: string) => {
  localStorage.setItem(PEER_ID_STORAGE_KEY, id);
};

const clearStoredPeerId = () => {
  localStorage.removeItem(PEER_ID_STORAGE_KEY);
};

const storePeers = (peers: string[]) => {
  localStorage.setItem(PEER_LIST_STORAGE_KEY, JSON.stringify(uniquePeers(peers)));
};

const addStoredPeer = (peerId: string) => {
  if (!peerId) return;
  const peers = readStoredPeers();
  if (!peers.includes(peerId)) {
    storePeers([...peers, peerId]);
  }
};

const removeStoredPeer = (peerId: string) => {
  if (!peerId) return;
  const peers = readStoredPeers().filter((id) => id !== peerId);
  storePeers(peers);
};

export const usePeerSync = (
  gameState: GameState,
  onRemoteUpdate: (state: GameState) => void
): {
  peerId: string;
  connectedPeers: string[];
  isConnecting: boolean;
  isReconnecting: boolean;
  connectToPeer: (remotePeerId: string) => Promise<void>;
  removePeer: (remotePeerId: string) => void;
  resetPeerId: () => void;
  broadcastState: (state: GameState) => void;
} => {
  const [peerId, setPeerId] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isPeerReady, setIsPeerReady] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const connectingPeersRef = useRef<Set<string>>(new Set());
  const storedPeersRef = useRef<string[]>([]);
  const gameStateRef = useRef(gameState);
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  const updateConnectingState = useCallback(
    (readyOverride?: boolean) => {
      const ready = readyOverride ?? isPeerReady;
      const hasPendingPeers =
        connectingPeersRef.current.size > 0 || storedPeersRef.current.length > 0;
      setIsReconnecting((!ready && hasPendingPeers) || connectingPeersRef.current.size > 0);
    },
    [isPeerReady]
  );
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    onRemoteUpdateRef.current = onRemoteUpdate;
  }, [onRemoteUpdate]);

  const setupConnection = useCallback((conn: DataConnection) => {
    console.log('setupConnection to:', conn.peer);
    const existingConnection = connectionsRef.current.get(conn.peer);
    if (existingConnection?.open || connectingPeersRef.current.has(conn.peer)) {
      conn.close();
      return;
    }
    if (existingConnection) {
      connectionsRef.current.delete(conn.peer);
    }

    connectionsRef.current.set(conn.peer, conn);

    conn.on('open', () => {
      console.log('Connected to:', conn.peer);
      connectingPeersRef.current.delete(conn.peer);
      addStoredPeer(conn.peer);
      setConnectedPeers((prev) => [...new Set([...prev, conn.peer])]);
      setIsConnecting(false);
      conn.send({ type: 'sync', state: gameStateRef.current });
    });

    conn.on('data', (data: { type: 'sync'; state: GameState }) => {
      if (data.type === 'sync') {
        onRemoteUpdateRef.current(data.state);
      }
    });

    conn.on('close', () => {
      console.log('Disconnected from:', conn.peer);
      connectionsRef.current.delete(conn.peer);
      setConnectedPeers((prev) => prev.filter((id) => id !== conn.peer));
    });

    conn.on('error', (err) => {
      console.error('Connection error:', err);
      connectionsRef.current.delete(conn.peer);
      setConnectedPeers((prev) => prev.filter((id) => id !== conn.peer));
    });
  }, []);

  const connectToPeer = useCallback(
    (remotePeerId: string, options: { silent?: boolean } = {}) => {
      if (!peerRef.current) return Promise.reject('Peer not initialized');
      if (!remotePeerId) return Promise.resolve();
      if (remotePeerId === peerRef.current.id) return Promise.resolve();

      const existingConnection = connectionsRef.current.get(remotePeerId);
      if (existingConnection?.open || connectingPeersRef.current.has(remotePeerId)) {
        return Promise.resolve();
      }

      if (!options.silent) {
        setIsConnecting(true);
      }
      connectingPeersRef.current.add(remotePeerId);
      updateConnectingState();

      return new Promise<void>((resolve, reject) => {
        const conn = peerRef.current!.connect(remotePeerId, {
          reliable: true,
        });

        connectionsRef.current.set(conn.peer, conn);

        const timeout = setTimeout(() => {
          if (!options.silent) {
            setIsConnecting(false);
          }
          connectingPeersRef.current.delete(conn.peer);
          updateConnectingState();
          connectionsRef.current.delete(conn.peer);
          reject(new Error('Verbindungs-Timeout - Mitspieler nicht erreichbar'));
        }, 10000);

        conn.on('open', () => {
          clearTimeout(timeout);
          console.log('Connected to:', conn.peer);
          connectingPeersRef.current.delete(conn.peer);
          updateConnectingState();
          addStoredPeer(conn.peer);
          setConnectedPeers((prev) => [...new Set([...prev, conn.peer])]);
          if (!options.silent) {
            setIsConnecting(false);
          }
          resolve();
        });

        conn.on('data', (data: { type: 'sync'; state: GameState }) => {
          if (data.type === 'sync') {
            onRemoteUpdateRef.current(data.state);
          }
        });

        conn.on('close', () => {
          console.log('Disconnected from:', conn.peer);
          connectingPeersRef.current.delete(conn.peer);
          updateConnectingState();
          connectionsRef.current.delete(conn.peer);
          setConnectedPeers((prev) => prev.filter((id) => id !== conn.peer));
        });

        conn.on('error', (err) => {
          clearTimeout(timeout);
          console.error('Connection error:', err);
          connectingPeersRef.current.delete(conn.peer);
          updateConnectingState();
          connectionsRef.current.delete(conn.peer);
          setConnectedPeers((prev) => prev.filter((id) => id !== conn.peer));
          if (!options.silent) {
            setIsConnecting(false);
          }
          reject(err);
        });
      });
    },
    [updateConnectingState]
  );

  const initPeer = useCallback(
    (requestedPeerId: string, storedPeers: string[]) => {
      console.log('Initializing PeerJS...');
      storedPeersRef.current = storedPeers;
      setIsPeerReady(false);
      updateConnectingState(false);
      const peer = requestedPeerId
        ? new Peer(requestedPeerId, { config: {} })
        : new Peer({ config: {} });
      peerRef.current = peer;

      peer.on('open', (id) => {
        console.log('Peer ID:', id);
        setPeerId(id);
        storePeerId(id);
        setIsPeerReady(true);
        updateConnectingState(true);

        if (storedPeersRef.current.length > 0) {
          storedPeersRef.current.forEach((remoteId) => {
            if (remoteId === id) return;
            if (connectionsRef.current.get(remoteId)?.open) return;
            void connectToPeer(remoteId, { silent: true });
          });
        }
      });

      peer.on('connection', (conn) => {
        setupConnection(conn);
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        setIsPeerReady(false);
        updateConnectingState(false);
        setIsConnecting(false);
      });
    },
    [connectToPeer, setupConnection, updateConnectingState]
  );

  useEffect(() => {
    const storedPeerId = readStoredPeerId();
    const storedPeers = readStoredPeers();
    initPeer(storedPeerId, storedPeers);

    return () => {
      connectionsRef.current.forEach((conn) => conn.close());
      peerRef.current?.destroy();
      setIsPeerReady(false);
      updateConnectingState(false);
    };
  }, [initPeer]);

  const removePeer = useCallback((remotePeerId: string) => {
    const connection = connectionsRef.current.get(remotePeerId);
    if (connection) {
      connection.close();
    }
    connectionsRef.current.delete(remotePeerId);
    connectingPeersRef.current.delete(remotePeerId);
    updateConnectingState();
    setConnectedPeers((prev) => prev.filter((id) => id !== remotePeerId));
    removeStoredPeer(remotePeerId);
  }, []);

  const resetPeerId = useCallback(() => {
    connectionsRef.current.forEach((conn) => conn.close());
    connectionsRef.current.clear();
    connectingPeersRef.current.clear();
    setConnectedPeers([]);
    setIsConnecting(false);
    setIsReconnecting(false);

    peerRef.current?.destroy();
    peerRef.current = null;
    setPeerId('');
    clearStoredPeerId();
    storePeers([]);

    initPeer('', []);
  }, [initPeer]);

  const broadcastState = useCallback((state: GameState) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'sync', state });
      }
    });
  }, []);

  return {
    peerId,
    connectedPeers,
    isConnecting,
    isReconnecting,
    connectToPeer,
    removePeer,
    resetPeerId,
    broadcastState,
  };
};

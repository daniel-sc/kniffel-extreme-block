import { useEffect, useRef, useState } from 'react';
import { GameState } from '@/types/game';
import Peer, { DataConnection } from 'peerjs';

export const usePeerSync = (
  gameState: GameState,
  onRemoteUpdate: (state: GameState) => void
): {
  peerId: string;
  connectedPeers: string[];
  isConnecting: boolean;
  connectToPeer: (remotePeerId: string) => Promise<void>;
  broadcastState: (state: GameState) => void;
} => {
  const [peerId, setPeerId] = useState<string>('');
  const [connectedPeers, setConnectedPeers] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());

  useEffect(() => {
    // Initialize PeerJS
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('Peer ID:', id);
      setPeerId(id);
    });

    peer.on('connection', (conn) => {
      setupConnection(conn);
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
      setIsConnecting(false);
    });

    return () => {
      connectionsRef.current.forEach((conn) => conn.close());
      peer.destroy();
    };
  }, []);

  const setupConnection = (conn: DataConnection) => {
    connectionsRef.current.set(conn.peer, conn);

    conn.on('open', () => {
      console.log('Connected to:', conn.peer);
      setConnectedPeers((prev) => [...new Set([...prev, conn.peer])]);
      setIsConnecting(false);
      
      // Send current state to new peer
      conn.send({ type: 'sync', state: gameState });
    });

    conn.on('data', (data: any) => {
      if (data.type === 'sync') {
        onRemoteUpdate(data.state);
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
  };

  const connectToPeer = (remotePeerId: string) => {
    if (!peerRef.current) return Promise.reject('Peer not initialized');
    
    setIsConnecting(true);
    
    return new Promise<void>((resolve, reject) => {
      const conn = peerRef.current!.connect(remotePeerId, {
        reliable: true,
      });
      
      connectionsRef.current.set(conn.peer, conn);
      
      // Add timeout for connection
      const timeout = setTimeout(() => {
        setIsConnecting(false);
        connectionsRef.current.delete(conn.peer);
        reject(new Error('Verbindungs-Timeout - Mitspieler nicht erreichbar'));
      }, 10000);
      
      conn.on('open', () => {
        clearTimeout(timeout);
        console.log('Connected to:', conn.peer);
        setConnectedPeers((prev) => [...new Set([...prev, conn.peer])]);
        setIsConnecting(false);
        
        // Send current state to new peer
        conn.send({ type: 'sync', state: gameState });
        resolve();
      });
      
      conn.on('data', (data: any) => {
        if (data.type === 'sync') {
          onRemoteUpdate(data.state);
        }
      });
      
      conn.on('close', () => {
        console.log('Disconnected from:', conn.peer);
        connectionsRef.current.delete(conn.peer);
        setConnectedPeers((prev) => prev.filter((id) => id !== conn.peer));
      });
      
      conn.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Connection error:', err);
        connectionsRef.current.delete(conn.peer);
        setConnectedPeers((prev) => prev.filter((id) => id !== conn.peer));
        setIsConnecting(false);
        reject(err);
      });
    });
  };

  const broadcastState = (state: GameState) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send({ type: 'sync', state });
      }
    });
  };

  return {
    peerId,
    connectedPeers,
    isConnecting,
    connectToPeer,
    broadcastState,
  };
};

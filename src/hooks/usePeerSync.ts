import { useEffect, useRef, useState } from 'react';
import { GameState } from '@/types/game';
import Peer, { DataConnection } from 'peerjs';

export const usePeerSync = (
  gameState: GameState,
  onRemoteUpdate: (state: GameState) => void
) => {
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
    if (!peerRef.current) return;
    
    setIsConnecting(true);
    const conn = peerRef.current.connect(remotePeerId, {
      reliable: true,
    });
    
    setupConnection(conn);
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

import type * as Party from 'partykit/server';

type SyncMessage =
  | { type: 'sync'; state: unknown }
  | { type: 'request-sync' }
  | { type: 'presence'; peers: string[] };

const STATE_KEY = 'latest-state';

export default class KniffelSyncServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onStart(): void {
    // Required so all WebSocket connections are restored using Cloudflare hibernation.
    this.room.context.blockConcurrencyWhile(async () => {
      await this.room.storage.get(STATE_KEY);
    });
  }

  async onConnect(connection: Party.Connection): Promise<void> {
    connection.setState({ id: connection.id });

    const latestState = await this.room.storage.get<unknown>(STATE_KEY);
    if (latestState !== undefined) {
      connection.send(JSON.stringify({ type: 'sync', state: latestState } satisfies SyncMessage));
    }

    this.broadcastPresence();
  }

  async onMessage(message: string, sender: Party.Connection): Promise<void> {
    let payload: SyncMessage;

    try {
      payload = JSON.parse(message) as SyncMessage;
    } catch {
      return;
    }

    if (payload.type === 'request-sync') {
      const latestState = await this.room.storage.get<unknown>(STATE_KEY);
      if (latestState !== undefined) {
        sender.send(JSON.stringify({ type: 'sync', state: latestState } satisfies SyncMessage));
      }
      return;
    }

    if (payload.type === 'sync') {
      await this.room.storage.put(STATE_KEY, payload.state);
      this.room.broadcast(JSON.stringify(payload));
    }
  }

  onClose(): void {
    this.broadcastPresence();
  }

  private broadcastPresence() {
    const peers = this.room
      .getConnections()
      .map((conn) => conn.id);

    for (const connection of this.room.getConnections()) {
      connection.send(
        JSON.stringify({
          type: 'presence',
          peers: peers.filter((peerId) => peerId !== connection.id),
        } satisfies SyncMessage),
      );
    }
  }
}

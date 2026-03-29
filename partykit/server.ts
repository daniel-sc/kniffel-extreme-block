import type * as Party from 'partykit/server';
import type { SyncMessage } from '../src/types/sync';

const STATE_KEY = 'latest-state';
const INACTIVITY_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

export default class KniffelSyncServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onStart(): void {
    // Required so all WebSocket connections are restored using Cloudflare hibernation.
    this.room.context.blockConcurrencyWhile(async () => {
      await this.room.storage.get(STATE_KEY);
      await this.scheduleCleanupAlarm();
    });
  }

  async onConnect(connection: Party.Connection): Promise<void> {
    connection.setState({ id: connection.id });

    const latestState = await this.room.storage.get<unknown>(STATE_KEY);
    if (latestState !== undefined) {
      connection.send(JSON.stringify({ type: 'sync', state: latestState } satisfies SyncMessage));
    }

    this.broadcastPresence();
    await this.scheduleCleanupAlarm();
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
      await this.scheduleCleanupAlarm();
      return;
    }

    if (payload.type === 'sync') {
      await this.room.storage.put(STATE_KEY, payload.state);
      this.room.broadcast(JSON.stringify(payload));
      await this.scheduleCleanupAlarm();
    }
  }

  async onClose(): Promise<void> {
    this.broadcastPresence();
    await this.scheduleCleanupAlarm();
  }

  async onAlarm(): Promise<void> {
    if (this.room.getConnections().length > 0) {
      await this.scheduleCleanupAlarm();
      return;
    }

    await this.room.storage.delete(STATE_KEY);
  }

  private async scheduleCleanupAlarm() {
    await this.room.storage.setAlarm(Date.now() + INACTIVITY_TIMEOUT_MS);
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

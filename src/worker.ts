import { routePartykitRequest, Server } from 'partyserver';
import type { Connection, WSMessage } from 'partyserver';
import type { SyncMessage } from './types/sync';

const STATE_KEY = 'latest-state';
const INACTIVITY_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

interface SyncConnectionState {
  sessionId: string;
}

export class KniffelSyncServer extends Server<Env> {
  static options = {
    hibernate: true,
  };

  async onStart(): Promise<void> {
    await this.scheduleCleanupAlarm();
  }

  async onConnect(connection: Connection<SyncConnectionState>): Promise<void> {
    const sessionId = crypto.randomUUID();
    connection.setState({ sessionId });
    this.closeStaleConnections(connection, sessionId);

    const latestState = await this.ctx.storage.get<unknown>(STATE_KEY);
    connection.send(
      JSON.stringify({
        type: 'initial-state',
        state: latestState ?? null,
      } satisfies SyncMessage),
    );

    this.broadcastPresence();
    await this.scheduleCleanupAlarm();
  }

  async onMessage(sender: Connection<SyncConnectionState>, message: WSMessage): Promise<void> {
    if (typeof message !== 'string') {
      console.warn('Received non-string message, ignoring.');
      return;
    }

    try {
      const payload: SyncMessage = JSON.parse(message) as SyncMessage;

      if (payload.type === 'sync') {
        await this.ctx.storage.put(STATE_KEY, payload.state);
        this.broadcast(JSON.stringify(payload), [sender.id]);
        await this.scheduleCleanupAlarm();
      }
    } catch {
      console.warn('Failed to parse message:', message);
    }
  }

  async onClose(_connection: Connection<SyncConnectionState>): Promise<void> {
    this.broadcastPresence();
    await this.scheduleCleanupAlarm();
  }

  async onAlarm(): Promise<void> {
    if (Array.from(this.getConnections()).length > 0) {
      await this.scheduleCleanupAlarm();
      return;
    }

    await this.ctx.storage.delete(STATE_KEY);
  }

  private async scheduleCleanupAlarm() {
    await this.ctx.storage.setAlarm(Date.now() + INACTIVITY_TIMEOUT_MS);
  }

  private closeStaleConnections(currentConnection: Connection<SyncConnectionState>, sessionId: string) {
    for (const connection of this.getConnections(currentConnection.id) as Iterable<Connection<SyncConnectionState>>) {
      if (connection.state?.sessionId !== sessionId) {
        connection.close(1000, 'Replaced by newer connection');
      }
    }
  }

  private broadcastPresence() {
    const connections = Array.from(this.getConnections());
    const peerIds = [...new Set(connections.map((connection) => connection.id))];

    for (const connection of connections) {
      connection.send(
        JSON.stringify({
          type: 'presence',
          peers: peerIds.filter((peerId) => peerId !== connection.id),
        } satisfies SyncMessage),
      );
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) {
      return partyResponse;
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;

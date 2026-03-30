import { routePartykitRequest, Server } from 'partyserver';
import type { Connection, WSMessage } from 'partyserver';
import type { SyncMessage } from './types/sync';

const STATE_KEY = 'latest-state';
const INACTIVITY_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;

export class KniffelSyncServer extends Server<Env> {
  static options = {
    hibernate: true,
  };

  async onStart(): Promise<void> {
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.ctx.storage.get(STATE_KEY);
      await this.scheduleCleanupAlarm();
    });
  }

  async onConnect(connection: Connection): Promise<void> {
    connection.setState({ id: connection.id });

    const latestState = await this.ctx.storage.get<unknown>(STATE_KEY);
    if (latestState !== undefined) {
      connection.send(JSON.stringify({ type: 'sync', state: latestState } satisfies SyncMessage));
    }

    this.broadcastPresence();
    await this.scheduleCleanupAlarm();
  }

  async onMessage(sender: Connection, message: WSMessage): Promise<void> {
    if (typeof message !== 'string') {
      return;
    }

    let payload: SyncMessage;

    try {
      payload = JSON.parse(message) as SyncMessage;
    } catch {
      return;
    }

    if (payload.type === 'sync') {
      await this.ctx.storage.put(STATE_KEY, payload.state);
      this.broadcast(JSON.stringify(payload));
      await this.scheduleCleanupAlarm();
    }
  }

  async onClose(_connection: Connection): Promise<void> {
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

  private broadcastPresence() {
    const connections = Array.from(this.getConnections());
    const peers = connections.map((connection) => connection.id);

    for (const connection of connections) {
      connection.send(
        JSON.stringify({
          type: 'presence',
          peers: peers.filter((peerId) => peerId !== connection.id),
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

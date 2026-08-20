import { EventEmitter } from 'events';
import type { RealtimeClient, RealtimeServer } from './realtime.types';

export interface RealtimeTransport {
  onConnection(handler: (client: RealtimeClient) => void): void;
  onSubscribe(handler: (client: RealtimeClient, payload: { channel: string }) => void): void;
  onUnsubscribe(handler: (client: RealtimeClient, payload: { channel: string }) => void): void;
  getServer(): RealtimeServer;
  emitNotification(channel: string, event: string, data: unknown): void;
}

export class EventEmitterTransport implements RealtimeTransport {
  private emitter = new EventEmitter();
  private clients = new Map<string, RealtimeClient>();
  private rooms = new Map<string, Set<RealtimeClient>>();

  onConnection(handler: (client: RealtimeClient) => void): void {
    this.emitter.on('connection', handler);
  }

  onSubscribe(handler: (client: RealtimeClient, payload: { channel: string }) => void): void {
    this.emitter.on('subscribe', handler);
  }

  onUnsubscribe(handler: (client: RealtimeClient, payload: { channel: string }) => void): void {
    this.emitter.on('unsubscribe', handler);
  }

  getServer(): RealtimeServer {
    const self = this;
    return {
      sockets: {
        adapter: {
          rooms: self.rooms as unknown as Map<string, Set<RealtimeClient>>,
        },
      },
      to: (channel: string) => ({
        emit: (event: string, data: unknown) => {
          self.emitNotification(channel, event, data);
        },
      }),
    };
  }

  emitNotification(channel: string, event: string, data: unknown): void {
    const room = this.rooms.get(channel);
    if (!room) return;
    for (const client of room) {
      client.emit(event, data);
    }
  }

  simulateConnection(client: RealtimeClient): void {
    this.clients.set(client.id, client);
    this.emitter.emit('connection', client);
  }

  simulateSubscribe(client: RealtimeClient, payload: { channel: string }): void {
    this.emitter.emit('subscribe', client, payload);
  }

  simulateUnsubscribe(client: RealtimeClient, payload: { channel: string }): void {
    this.emitter.emit('unsubscribe', client, payload);
  }

  joinRoom(channel: string, client: RealtimeClient): void {
    if (!this.rooms.has(channel)) {
      this.rooms.set(channel, new Set());
    }
    this.rooms.get(channel)!.add(client);
  }

  leaveRoom(channel: string, client: RealtimeClient): void {
    const room = this.rooms.get(channel);
    if (room) {
      room.delete(client);
      if (room.size === 0) {
        this.rooms.delete(channel);
      }
    }
  }

  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      for (const [channel, room] of this.rooms) {
        room.delete(client);
        if (room.size === 0) {
          this.rooms.delete(channel);
        }
      }
      this.clients.delete(clientId);
    }
  }
}
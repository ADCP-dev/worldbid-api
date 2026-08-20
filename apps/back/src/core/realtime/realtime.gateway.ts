import { Injectable, Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { SpecLoader } from '../spec-engine/spec-loader';
import type {
  AuthenticatedUser,
  ResourceSpec,
  FieldPermissionSpec,
  PermissionRole,
} from '../spec-engine/spec.types';
import type { RealtimeClient, RealtimeEvent } from './realtime.types';
import type { RealtimeTransport } from './realtime.transport';

@Injectable()
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);
  private specRegistry: Map<string, ResourceSpec> = new Map();

  constructor(
    private readonly jwtService: JwtService,
    private readonly transport: RealtimeTransport,
    specLoader: SpecLoader,
  ) {
    this.loadSpecs(specLoader);
  }

  private loadSpecs(specLoader: SpecLoader): void {
    try {
      const loaded = specLoader.load();
      for (const l of loaded) {
        for (const res of l.spec.resources) {
          if (res.realtime) {
            this.specRegistry.set(res.name, res);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Could not load specs for realtime: ${(err as Error).message}`);
    }
  }

  async handleConnection(client: RealtimeClient): Promise<void> {
    const token = client.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        id: number;
        role: { id: number; name: string };
        sessionId: string;
        language: string;
        iat: number;
        exp: number;
      }>(token);
      client.data.user = {
        id: payload.id,
        role: payload.role,
        sessionId: payload.sessionId,
        language: payload.language,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      client.disconnect();
    }
  }

  handleSubscribe(client: RealtimeClient, payload: { channel: string }): void {
    const user = client.data.user;
    if (!user) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }
    if (!this.canSubscribe(user, payload.channel)) {
      client.emit('error', { message: 'Permission denied' });
      return;
    }
    client.join(payload.channel);
  }

  handleUnsubscribe(client: RealtimeClient, payload: { channel: string }): void {
    client.leave(payload.channel);
  }

  broadcastChange(channel: string, event: RealtimeEvent): void {
    const spec = this.channelToSpec(channel);
    if (!spec) {
      this.transport.emitNotification(channel, 'change', event);
      return;
    }

    const room = this.transport.getServer().sockets.adapter.rooms.get(channel);
    if (!room) return;

    for (const client of room) {
      const user = client.data.user;
      if (!user) continue;

      let filteredEvent = event;

      if (event.data && spec.permissions?.rowLevel) {
        const mode = spec.realtime?.rowLevelFiltering ?? 'server';
        if (mode === 'server') {
          const filter = spec.permissions.rowLevel[user.role.name]?.filter;
          if (filter && !this.evaluateRowLevel(filter, event.data, user)) {
            continue;
          }
        }
      }

      if (event.data && spec.permissions?.fields) {
        filteredEvent = {
          ...event,
          data: this.scrubFields(event.data, spec.permissions.fields, user.role.name),
        };
      }

      client.emit('change', filteredEvent);
    }
  }

  private canSubscribe(user: AuthenticatedUser, channel: string): boolean {
    if (user.role.name === 'admin') return true;
    const spec = this.channelToSpec(channel);
    if (!spec) return false;
    const readRoles = spec.permissions?.read;
    if (!readRoles) return false;
    return readRoles.some((r: PermissionRole) => r === user.role.name);
  }

  private channelToSpec(channel: string): ResourceSpec | undefined {
    for (const spec of this.specRegistry.values()) {
      const specChannel = spec.realtime?.channel ?? spec.name;
      if (specChannel === channel) return spec;
    }
    return undefined;
  }

  private evaluateRowLevel(
    filter: string,
    data: Record<string, unknown>,
    user: AuthenticatedUser,
  ): boolean {
    const expanded = filter.replace(/\$\{user\.id\}/g, String(user.id));
    const match = expanded.match(/^(\w+)\s*==\s*(.+)$/);
    if (!match) return true;
    const [, field, valueStr] = match;
    const dataValue = data[field];
    const expected = valueStr.replace(/['"]/g, '');
    return String(dataValue) === expected;
  }

  private scrubFields(
    data: Record<string, unknown>,
    fields: Record<string, FieldPermissionSpec>,
    role: string,
  ): Record<string, unknown> {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const fieldPerm = fields[key];
      if (fieldPerm?.read && !fieldPerm.read.some((r: PermissionRole) => r === role)) {
        continue;
      }
      scrubbed[key] = value;
    }
    return scrubbed;
  }
}
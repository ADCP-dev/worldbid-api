import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { RealtimeGateway } from './realtime.gateway';
import type { SpecLoader } from '../spec-engine/spec-loader';
import type { RealtimeEvent } from './realtime.types';

@Injectable()
export class PostgresListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresListener.name);
  private client: pg.Client | null = null;
  private channels: string[] = [];
  private reconnectAttempts = 0;
  private readonly maxBackoffMs = 30000;
  private reconnecting = false;
  private destroyed = false;

  constructor(
    private readonly gateway: RealtimeGateway,
    private readonly configService: ConfigService,
    private readonly specLoader: SpecLoader,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.destroyed = true;
    if (this.client) {
      try {
        await this.client.end();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }

  async addChannel(channel: string): Promise<void> {
    if (!this.client) return;
    if (this.channels.includes(channel)) return;
    this.channels.push(channel);
    await this.client.query(`LISTEN "${channel}"`);
  }

  async removeChannel(channel: string): Promise<void> {
    if (!this.client) return;
    this.channels = this.channels.filter((c) => c !== channel);
    await this.client.query(`UNLISTEN "${channel}"`);
  }

  private async connect(): Promise<void> {
    const dbUrl = this.configService.get<string>('database.url') ??
      this.buildUrlFromConfig();
    this.client = new pg.Client(dbUrl);

    this.client.on('notification', (msg: { channel: string; payload?: string }) => {
      this.handleNotification(msg);
    });

    this.client.on('error', (err: Error) => {
      this.logger.error(`Postgres LISTEN connection error: ${err.message}`);
      this.scheduleReconnect();
    });

    this.client.on('end', () => {
      if (!this.destroyed) {
        this.logger.warn('Postgres LISTEN connection lost. Scheduling reconnect...');
        this.scheduleReconnect();
      }
    });

    await this.client.connect();
    this.reconnectAttempts = 0;

    const channels = this.getRealtimeChannels();
    this.channels = channels;
    for (const channel of channels) {
      await this.client.query(`LISTEN "${channel}"`);
    }
    this.logger.log(`Listening on ${channels.length} realtime channels: ${channels.join(', ')}`);
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.reconnecting || this.destroyed) return;
    this.reconnecting = true;
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxBackoffMs);
    this.reconnectAttempts++;
    this.logger.warn(`Reconnecting in ${backoffMs}ms (attempt ${this.reconnectAttempts})...`);
    setTimeout(async () => {
      try {
        if (this.client) {
          try { await this.client.end(); } catch { /* ignore */ }
          this.client = null;
        }
        await this.connect();
        this.logger.log('Reconnected successfully. Re-listening channels.');
      } catch (err) {
        this.logger.error(`Reconnect failed: ${(err as Error).message}`);
        this.reconnecting = false;
        this.scheduleReconnect();
      } finally {
        this.reconnecting = false;
      }
    }, backoffMs);
  }

  private handleNotification(msg: { channel: string; payload?: string }): void {
    if (!msg.payload) return;
    try {
      const event = JSON.parse(msg.payload) as RealtimeEvent;
      this.gateway.broadcastChange(msg.channel, event);
    } catch (err) {
      this.logger.warn(`Failed to parse NOTIFY payload on "${msg.channel}": ${(err as Error).message}`);
    }
  }

  private getRealtimeChannels(): string[] {
    const channels: string[] = [];
    try {
      const loaded = this.specLoader.load();
      for (const l of loaded) {
        for (const res of l.spec.resources) {
          if (res.realtime) {
            channels.push(res.realtime.channel ?? res.name);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Could not load specs for realtime channels: ${(err as Error).message}`);
    }
    return [...new Set(channels)];
  }

  private buildUrlFromConfig(): string {
    const host = this.configService.get<string>('database.host') ?? 'localhost';
    const port = this.configService.get<string>('database.port') ?? '5432';
    const user = this.configService.get<string>('database.username') ?? 'dev';
    const password = this.configService.get<string>('database.password') ?? 'dev123';
    const db = this.configService.get<string>('database.name') ?? 'foundation';
    return `postgres://${user}:${password}@${host}:${port}/${db}`;
  }
}
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { PostgresListener } from './postgres-listener';
import { EventEmitterTransport, type RealtimeTransport } from './realtime.transport';

@Module({
  imports: [JwtModule.register({})],
  providers: [
    RealtimeGateway,
    PostgresListener,
    {
      provide: 'REALTIME_TRANSPORT',
      useClass: EventEmitterTransport,
    },
    {
      provide: RealtimeTransport,
      useExisting: 'REALTIME_TRANSPORT',
    },
  ],
  exports: [RealtimeGateway, PostgresListener],
})
export class RealtimeModule {}
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { UpPostAutodmMonitorEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-autodm-monitor.entity';

@Injectable()
export class AutodmService {
  private readonly logger = new Logger(AutodmService.name);

  constructor(
    private readonly client: UploadPostClientService,
    @InjectRepository(UpPostAutodmMonitorEntity)
    private readonly monitorRepo: Repository<UpPostAutodmMonitorEntity>,
  ) {}

  async startMonitor(params: {
    postUrl: string;
    replyMessage: string;
    profileUsername?: string;
    monitoringInterval?: number;
    triggerKeywords?: string[];
  }) {
    const user = params.profileUsername ?? this.client.profileUsername;
    if (!user) throw new Error('profileUsername is required (not configured)');

    const result = await this.client.startAutodmMonitor({
      postUrl: params.postUrl,
      replyMessage: params.replyMessage,
      profileUsername: user,
      monitoringInterval: params.monitoringInterval,
      triggerKeywords: params.triggerKeywords,
    });

    const monitorId = result.monitor_id ?? result.id;
    if (monitorId) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 15);

      await this.monitorRepo.save(
        this.monitorRepo.create({
          monitorId,
          postUrl: params.postUrl,
          replyMessage: params.replyMessage,
          triggerKeywords: params.triggerKeywords ?? [],
          monitoringInterval: params.monitoringInterval ?? 15,
          status: 'running',
          expiresAt,
        }),
      );
    }

    return result;
  }

  async getStatus(includeInactive = false) {
    const result = await this.client.getAutodmStatus(includeInactive);

    // Sync local DB
    if (result.monitors) {
      for (const m of result.monitors) {
        const local = await this.monitorRepo.findOne({
          where: { monitorId: m.monitor_id },
        });
        if (local) {
          local.status = m.status;
          local.dmsSent = m.dms_sent ?? local.dmsSent;
          await this.monitorRepo.save(local);
        }
      }
    }

    return result;
  }

  async getLogs(monitorId: string) {
    return this.client.getAutodmLogs(monitorId);
  }

  async pause(monitorId: string) {
    await this.client.pauseAutodmMonitor(monitorId);
    await this.updateLocalStatus(monitorId, 'paused');
    return { monitorId, status: 'paused' };
  }

  async resume(monitorId: string) {
    await this.client.resumeAutodmMonitor(monitorId);
    await this.updateLocalStatus(monitorId, 'running');
    return { monitorId, status: 'running' };
  }

  async stop(monitorId: string) {
    await this.client.stopAutodmMonitor(monitorId);
    await this.updateLocalStatus(monitorId, 'stopped');
    return { monitorId, status: 'stopped' };
  }

  async delete(monitorId: string) {
    await this.client.deleteAutodmMonitor(monitorId);
    await this.monitorRepo.delete({ monitorId });
    return { monitorId, deleted: true };
  }

  async getLocalMonitors() {
    return this.monitorRepo.find({ order: { createdAt: 'DESC' } });
  }

  private async updateLocalStatus(
    monitorId: string,
    status: UpPostAutodmMonitorEntity['status'],
  ) {
    const local = await this.monitorRepo.findOne({ where: { monitorId } });
    if (local) {
      local.status = status;
      if (status === 'stopped') {
        local.stoppedAt = new Date();
      }
      await this.monitorRepo.save(local);
    }
  }
}

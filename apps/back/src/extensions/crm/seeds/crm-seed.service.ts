import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmStatusEntity } from '../infrastructure/persistence/entities/crm-status.entity';
import { CrmOriginEntity } from '../infrastructure/persistence/entities/crm-origin.entity';

@Injectable()
export class CrmSeedService {
  private readonly logger = new Logger(CrmSeedService.name);

  constructor(
    @InjectRepository(CrmStatusEntity)
    private readonly statusRepository: Repository<CrmStatusEntity>,
    @InjectRepository(CrmOriginEntity)
    private readonly originRepository: Repository<CrmOriginEntity>,
  ) {}

  async run() {
    await this.seedStatuses();
    await this.seedOrigins();
  }

  private async seedStatuses() {
    const statuses = [
      {
        name: 'lead',
        label: 'Lead',
        color: '#6c8cff',
        sortOrder: 1,
        isDefault: true,
      },
      {
        name: 'discovery',
        label: 'Discovery',
        color: '#36c2a8',
        sortOrder: 2,
        isDefault: false,
      },
      {
        name: 'proposed',
        label: 'Proposed',
        color: '#f5a623',
        sortOrder: 3,
        isDefault: false,
      },
      {
        name: 'active',
        label: 'Active',
        color: '#3cb878',
        sortOrder: 4,
        isDefault: false,
      },
      {
        name: 'churned',
        label: 'Churned',
        color: '#e0604e',
        sortOrder: 5,
        isDefault: false,
      },
    ];

    for (const s of statuses) {
      const existing = await this.statusRepository.findOne({
        where: { name: s.name },
      });
      if (!existing) {
        await this.statusRepository.save(this.statusRepository.create(s));
        this.logger.log(`Seeded status: ${s.name}`);
      } else {
        let changed = false;
        if (existing.label !== s.label) {
          existing.label = s.label;
          changed = true;
        }
        if (existing.color !== s.color) {
          existing.color = s.color;
          changed = true;
        }
        if (existing.sortOrder !== s.sortOrder) {
          existing.sortOrder = s.sortOrder;
          changed = true;
        }
        if (existing.isDefault !== s.isDefault) {
          existing.isDefault = s.isDefault;
          changed = true;
        }
        if (changed) {
          await this.statusRepository.save(existing);
          this.logger.log(`Updated status: ${s.name}`);
        }
      }
    }
  }

  private async seedOrigins() {
    const origins = [
      { name: 'networking', label: 'Networking', sortOrder: 1 },
      { name: 'linkedin', label: 'LinkedIn', sortOrder: 2 },
      { name: 'web_form', label: 'Web Form', sortOrder: 3 },
      { name: 'gbp', label: 'Google Business Profile', sortOrder: 4 },
      { name: 'cold_email', label: 'Cold Email', sortOrder: 5 },
      { name: 'referral', label: 'Referral', sortOrder: 6 },
      { name: 'other', label: 'Other', sortOrder: 7 },
    ];

    for (const o of origins) {
      const existing = await this.originRepository.findOne({
        where: { name: o.name },
      });
      if (!existing) {
        await this.originRepository.save(this.originRepository.create(o));
        this.logger.log(`Seeded origin: ${o.name}`);
      } else {
        let changed = false;
        if (existing.label !== o.label) {
          existing.label = o.label;
          changed = true;
        }
        if (existing.sortOrder !== o.sortOrder) {
          existing.sortOrder = o.sortOrder;
          changed = true;
        }
        if (changed) {
          await this.originRepository.save(existing);
          this.logger.log(`Updated origin: ${o.name}`);
        }
      }
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleEntity } from '@iam/roles/infrastructure/entities/role.entity';
import { RoleEnum } from '@iam/roles/roles.enum';

@Injectable()
export class RoleSeedService {
  private readonly logger = new Logger(RoleSeedService.name);

  constructor(
    @InjectRepository(RoleEntity)
    private repository: Repository<RoleEntity>,
  ) {}

  async run() {
    await this.seedRole(RoleEnum.customer, 'customer', '/app');
    await this.seedRole(RoleEnum.admin, 'admin', '/app');
    await this.seedRole(RoleEnum.affiliate, 'affiliate', '/app/portal');
  }

  private async seedRole(
    id: RoleEnum,
    name: string,
    homeRoute: string,
  ): Promise<void> {
    const existing = await this.repository.findOne({ where: { id } });
    if (!existing) {
      await this.repository.save(
        this.repository.create({ id, name, homeRoute }),
      );
      this.logger.log(`Seeded role: ${name}`);
    } else if (existing.homeRoute !== homeRoute) {
      existing.homeRoute = homeRoute;
      await this.repository.save(existing);
      this.logger.log(`Updated homeRoute for role: ${name}`);
    }
  }
}

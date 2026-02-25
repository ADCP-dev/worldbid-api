import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { RoleEnum } from '@iam/roles/roles.enum';
import { StatusEnum } from '@users/statuses/statuses.enum';
import { UserEntity } from '@users/infrastructure/entities/user.entity';

@Injectable()
export class UserSeedService {
  constructor(
    @InjectRepository(UserEntity)
    private repository: Repository<UserEntity>,
  ) {}

  async run() {
    const existingAdmin = await this.repository.count({
      where: {
        email: 'admin@example.com',
      },
      withDeleted: true,
    });

    if (!existingAdmin) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash('secret', salt);

      await this.repository.save(
        this.repository.create({
          firstName: 'Super',
          lastName: 'Admin',
          email: 'admin@example.com',
          password,
          role: {
            id: RoleEnum.admin,
            name: 'admin',
          },
          status: {
            id: StatusEnum.active,
            name: 'active',
          },
        }),
      );
    }

    const existingUser = await this.repository.count({
      where: {
        email: 'john.doe@example.com',
      },
      withDeleted: true,
    });

    if (!existingUser) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash('secret', salt);

      await this.repository.save(
        this.repository.create({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password,
          role: {
            id: RoleEnum.customer,
            name: 'customer',
          },
          status: {
            id: StatusEnum.active,
            name: 'active',
          },
        }),
      );
    }
  }
}

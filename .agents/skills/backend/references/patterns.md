# NestJS Patterns — Reference

> Detail for `backend` skill. See the SKILL.md for core rules.

## Entity with Relations
```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity('ext_blog_posts')
export class BlogPostEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  // FK: featuredImageId → FileEntity
  @ManyToOne(() => FileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'featuredImageId' })
  featuredImage?: FileEntity | null;

  @Column({ type: 'uuid', nullable: true })
  featuredImageId?: string | null;

  // FK: authorId → UserEntity
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author?: UserEntity | null;

  @Column({ type: 'int', nullable: true })
  authorId?: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

## Repository with plainToInstance (NO mappers)
```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { UserEntity } from './entities/user.entity';
import { User } from '../../domain/user';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const raw = await this.repo.findOne({
      where: { id },
      relations: ['role', 'photo'],
    });
    return raw ? plainToInstance(User, raw, { excludeExtraneousValues: true }) : null;
  }

  async findAll(): Promise<User[]> {
    const raw = await this.repo.find({ relations: ['role'] });
    return plainToInstance(User, raw, { excludeExtraneousValues: true });
  }

  async create(data: Partial<UserEntity>): Promise<User> {
    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    return plainToInstance(User, saved, { excludeExtraneousValues: true });
  }

  async update(id: string, data: Partial<UserEntity>): Promise<User> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }
}
```

## DTO with Validation
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;
}
```

## Controller with Guards
```typescript
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/authorization/guards/roles.guard';
import { Roles } from '@iam/authorization/decorators/roles.decorator';
import { RoleEnum } from '@users/domain/role.enum';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }
}
```

## Module Registration
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './infrastructure/entities/user.entity';
import { UserRepository } from './infrastructure/user.repository';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersService, UserRepository],
  exports: [UsersService],
})
export class UsersModule {}
```

## Error Handling
```typescript
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';

// Entity not found
throw new NotFoundException(`User with ID ${id} not found`);

// Validation error
throw new UnprocessableEntityException({ errors: { email: 'alreadyExists' } });
```

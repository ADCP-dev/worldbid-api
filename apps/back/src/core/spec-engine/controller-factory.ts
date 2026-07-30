/**
 * ControllerFactory — creates dynamic NestJS controllers from ResourceSpec.
 *
 * This is the core of the spec engine: instead of generating .ts controller files,
 * we build controller classes at runtime using NestJS DynamicModule + metadata reflection.
 *
 * Each resource gets:
 *   GET    /<resource>          → findAll (paginated)
 *   GET    /<resource>/:id      → findOne
 *   POST   /<resource>          → create (Zod validated)
 *   PATCH  /<resource>/:id      → update (Zod validated)
 *   DELETE /<resource>/:id      → softDelete
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { z } from 'zod';

import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

import type { ResourceSpec, PermissionRole } from './spec.types';
import { ValidationFactory } from './validation-factory';

// Role name → RoleEnum value map
const ROLE_MAP: Record<PermissionRole, number | null> = {
  admin: RoleEnum.admin,
  customer: RoleEnum.customer,
  affiliate: RoleEnum.affiliate,
  public: null,
};

export interface MaterializedController {
  controllerClass: any;
  entitySchemaName: string; // used for DI token
}

export class ControllerFactory {
  /**
   * Build a dynamic controller class from a ResourceSpec.
   *
   * The controller uses a repository injected via the entity schema name as DI token.
   * The service layer is inlined — no separate service class needed for standard CRUD.
   */
  static create(
    spec: ResourceSpec,
    entitySchemaName: string,
  ): MaterializedController {
    const resourceName = spec.name;
    const displayName = spec.displayName || resourceName;
    const routePath = this.pluralize(resourceName);
    const createSchema = ValidationFactory.createCreateSchema(spec);
    const updateSchema = ValidationFactory.createUpdateSchema(spec);

    // Determine required roles for each action
    const perms = spec.permissions || {};
    const listRoles = this.resolveRoles(perms.list || ['admin']);
    const readRoles = this.resolveRoles(perms.read || ['admin']);
    const createRoles = this.resolveRoles(perms.create || ['admin']);
    const updateRoles = this.resolveRoles(perms.update || ['admin']);
    const deleteRoles = this.resolveRoles(perms.delete || ['admin']);

    // We need to use @Inject with the entity schema name as token.
    // NestJS TypeOrmModule.forFeature([entitySchema]) registers a Repository
    // with the entity schema name as the DI token.
    const diToken = entitySchemaName;

    @ApiTags(displayName)
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Controller({ path: routePath, version: '1' })
    class SpecDynamicController {
      private readonly logger = new Logger(`SpecController:${displayName}`);

      constructor(
        @Inject(diToken) private readonly repository: Repository<any>,
      ) {}

      @Get()
      @Roles(...listRoles)
      async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
      ) {
        const pageNum = page ? Math.max(1, Number(page)) : 1;
        const limitNum = limit ? Math.min(100, Number(limit)) : 20;
        const skip = (pageNum - 1) * limitNum;

        const [items, total] = await this.repository.findAndCount({
          skip,
          take: limitNum,
          order: { id: 'DESC' as any },
          withDeleted: false,
        });

        return {
          data: items,
          meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        };
      }

      @Get(':id')
      @Roles(...readRoles)
      async findOne(@Param('id') id: string) {
        const entity = await this.repository.findOne({
          where: { id: Number(id) },
        });
        if (!entity) {
          throw new NotFoundException(
            `${displayName} with ID ${id} not found`,
          );
        }
        return entity;
      }

      @Post()
      @HttpCode(HttpStatus.CREATED)
      @Roles(...createRoles)
      async create(@Body() body: unknown) {
        const result = createSchema.safeParse(body);
        if (!result.success) {
          const errors = result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          }));
          throw new BadRequestException({ validation: errors });
        }

        const entity = this.repository.create(result.data);
        const saved = await this.repository.save(entity);
        this.logger.log(`Created ${resourceName} id=${saved.id}`);
        return saved;
      }

      @Patch(':id')
      @Roles(...updateRoles)
      async update(@Param('id') id: string, @Body() body: unknown) {
        const result = updateSchema.safeParse(body);
        if (!result.success) {
          const errors = result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          }));
          throw new BadRequestException({ validation: errors });
        }

        const existing = await this.repository.findOne({
          where: { id: Number(id) },
        });
        if (!existing) {
          throw new NotFoundException(
            `${displayName} with ID ${id} not found`,
          );
        }

        Object.assign(existing, result.data);
        const saved = await this.repository.save(existing);
        this.logger.log(`Updated ${resourceName} id=${id}`);
        return saved;
      }

      @Delete(':id')
      @HttpCode(HttpStatus.NO_CONTENT)
      @Roles(...deleteRoles)
      async remove(@Param('id') id: string) {
        const entity = await this.repository.findOne({
          where: { id: Number(id) },
        });
        if (!entity) {
          throw new NotFoundException(
            `${displayName} with ID ${id} not found`,
          );
        }
        await this.repository.softDelete(Number(id));
        this.logger.log(`Soft-deleted ${resourceName} id=${id}`);
      }
    }

    // Give the dynamic class a useful name for debugging
    Object.defineProperty(SpecDynamicController, 'name', {
      value: `${this.pascalCase(resourceName)}SpecController`,
    });

    return {
      controllerClass: SpecDynamicController,
      entitySchemaName,
    };
  }

  /**
   * Convert permission role names to RoleEnum values
   */
  private static resolveRoles(roles: PermissionRole[]): number[] {
    return roles
      .map((r) => ROLE_MAP[r])
      .filter((r): r is number => r !== null);
  }

  /**
   * Very simple pluralization — good enough for most resource names
   */
  private static pluralize(name: string): string {
    if (name.endsWith('s')) return name;
    if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
    if (name.endsWith('ch') || name.endsWith('sh') || name.endsWith('x')) {
      return name + 'es';
    }
    return name + 's';
  }

  /**
   * Convert kebab-case or snake_case to PascalCase
   */
  private static pascalCase(name: string): string {
    return name
      .split(/[-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
  }
}
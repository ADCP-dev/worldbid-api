import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ModelRepository } from './infrastructure/model.repository';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';
import { Model } from './domain/model';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

/**
 * Models are admin-managed.
 *
 * - GET (list/inspect/active): any authenticated user (needed to populate
 *   the agent-config model select and to show available models in the UI).
 * - POST/PATCH/DELETE (mutations): admin only. RBAC enforced via
 *   `@Roles(RoleEnum.admin)` + `RolesGuard`, matching the Foundation pattern
 *   used by the Stripe extension (e.g. ProductsController).
 */
@ApiTags('Knowledge Models')
@JwtAuth()
@Controller({
  path: 'ka/models',
  version: '1',
})
export class ModelController {
  constructor(private readonly repository: ModelRepository) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiCreatedResponse({ type: Model })
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateModelDto): Promise<Model> {
    // Exclusive active: activating a model deactivates every other model in
    // the same provider so only one active model exists per provider.
    if (dto.active === true) {
      await this.repository.deactivateByProvider(dto.providerId);
    }
    return this.repository.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [Model] })
  findAll(@Query('providerId') providerId?: string): Promise<Model[]> {
    if (providerId) return this.repository.findByProviderId(providerId);
    return this.repository.find();
  }

  @Get('active')
  @ApiOkResponse({ type: [Model] })
  findActive(): Promise<Model[]> {
    return this.repository.findActive();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: Model })
  findById(@Param('id') id: string): Promise<Model | null> {
    return this.repository.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: Model })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateModelDto,
  ): Promise<Model> {
    // Exclusive active: activating a model deactivates every other model in
    // the same provider so only one active model exists per provider.
    if (dto.active === true) {
      const model = await this.repository.findById(id);
      if (model) {
        await this.repository.deactivateByProvider(model.providerId, id);
      }
    }
    return this.repository.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.repository.remove(id);
  }
}
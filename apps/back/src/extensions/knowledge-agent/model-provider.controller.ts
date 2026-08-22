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
import { ModelProviderRepository } from './infrastructure/model-provider.repository';
import { CreateModelProviderDto } from './dto/create-model-provider.dto';
import { UpdateModelProviderDto } from './dto/update-model-provider.dto';
import { ModelProvider } from './domain/model-provider';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

/**
 * Model providers are an admin-managed registry.
 *
 * - GET (list/inspect): any authenticated user (needed to populate the
 *   agent-config model select and to display provider names in the UI).
 * - POST/PATCH/DELETE (mutations): admin only. RBAC enforced via
 *   `@Roles(RoleEnum.admin)` + `RolesGuard`, matching the Foundation pattern
 *   used by the Stripe extension (e.g. ProductsController).
 */
@ApiTags('Knowledge Model Providers')
@JwtAuth()
@Controller({
  path: 'ka/model-providers',
  version: '1',
})
export class ModelProviderController {
  constructor(private readonly repository: ModelProviderRepository) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiCreatedResponse({ type: ModelProvider })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateModelProviderDto): Promise<ModelProvider> {
    return this.repository.create(dto);
  }

  @Get()
  @ApiOkResponse({ type: [ModelProvider] })
  findAll(): Promise<ModelProvider[]> {
    return this.repository.find();
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: ModelProvider })
  findById(@Param('id') id: string): Promise<ModelProvider | null> {
    return this.repository.findById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: ModelProvider })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModelProviderDto,
  ): Promise<ModelProvider> {
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
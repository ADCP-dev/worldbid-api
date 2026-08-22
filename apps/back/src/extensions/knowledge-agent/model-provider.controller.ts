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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ModelProviderRepository } from '../infrastructure/model-provider.repository';
import { CreateModelProviderDto } from '../dto/create-model-provider.dto';
import { UpdateModelProviderDto } from '../dto/update-model-provider.dto';
import { ModelProvider } from '../domain/model-provider';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

/**
 * Model providers are an admin-managed registry. RBAC is enforced at the
 * service layer (only admin users may create/update). All authenticated
 * users may list providers (needed to populate the agent-config model select).
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
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: ModelProvider })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModelProviderDto,
  ): Promise<ModelProvider> {
    return this.repository.update(id, dto);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiNoContentResponse()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.repository.remove(id);
  }
}
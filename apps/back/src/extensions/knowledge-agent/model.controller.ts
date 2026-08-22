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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ModelRepository } from '../infrastructure/model.repository';
import { CreateModelDto } from '../dto/create-model.dto';
import { UpdateModelDto } from '../dto/update-model.dto';
import { Model } from '../domain/model';
import { JwtAuth } from '@iam/auth/decorators/auth.decorator';

/**
 * Models are admin-managed. All authenticated users may list/inspect models
 * (needed to populate the agent-config model select). Create/update is RBAC
 * admin at the service layer.
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
  @ApiCreatedResponse({ type: Model })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateModelDto): Promise<Model> {
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
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ type: Model })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateModelDto,
  ): Promise<Model> {
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
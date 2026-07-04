import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { CrmInteractionService } from '../services/crm-interaction.service';
import { CreateInteractionDto } from '../dto/create-interaction.dto';
import { UpdateInteractionDto } from '../dto/update-interaction.dto';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'crm/clients/:clientId/interactions', version: '1' })
export class CrmInteractionController {
  constructor(private readonly interactionService: CrmInteractionService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Param('clientId') clientId: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.interactionService.findByClient(
      Number(clientId),
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('clientId') clientId: number, @Body() dto: CreateInteractionDto) {
    dto.clientId = Number(clientId);
    return this.interactionService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: number,
    @Body() dto: UpdateInteractionDto,
  ) {
    return this.interactionService.update(Number(id), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number) {
    return this.interactionService.delete(Number(id));
  }
}
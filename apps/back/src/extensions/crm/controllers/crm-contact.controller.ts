import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { CrmContactService } from '../services/crm-contact.service';
import { CreateContactDto } from '../dto/create-contact.dto';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'crm/clients/:clientId/contacts', version: '1' })
export class CrmContactController {
  constructor(private readonly contactService: CrmContactService) {}

  @Get()
  findAll(@Param('clientId') clientId: number) {
    return this.contactService.findByClient(Number(clientId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Param('clientId') clientId: number, @Body() dto: CreateContactDto) {
    dto.clientId = Number(clientId);
    return this.contactService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: number,
    @Body() dto: Partial<CreateContactDto>,
  ) {
    return this.contactService.update(Number(id), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number) {
    return this.contactService.softDelete(Number(id));
  }
}
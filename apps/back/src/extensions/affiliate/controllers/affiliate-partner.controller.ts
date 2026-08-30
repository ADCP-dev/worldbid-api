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
import { AffiliatePartnerService } from '../services/affiliate-partner.service';
import { CreatePartnerDto } from '../dto/create-partner.dto';
import { UpdatePartnerDto } from '../dto/update-partner.dto';
import { CreatePartnerFromClientDto } from '../dto/create-partner-from-client.dto';

@ApiTags('Affiliate')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'affiliate/partners', version: '1' })
export class AffiliatePartnerController {
  constructor(private readonly partnerService: AffiliatePartnerService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.partnerService.findAll({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.partnerService.findOne(Number(id));
  }

  @Get(':id/pipeline')
  pipeline(@Param('id') id: number) {
    return this.partnerService.getPipeline(Number(id));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePartnerDto) {
    return this.partnerService.create(dto);
  }

  @Post('from-client/:clientId')
  @HttpCode(HttpStatus.CREATED)
  createFromClient(
    @Param('clientId') clientId: number,
    @Body() dto: CreatePartnerFromClientDto,
  ) {
    return this.partnerService.createFromClient(Number(clientId), dto);
  }

  @Patch(':id')
  update(@Param('id') id: number, @Body() dto: UpdatePartnerDto) {
    return this.partnerService.update(Number(id), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: number) {
    return this.partnerService.softDelete(Number(id));
  }

  @Post(':id/invite')
  @HttpCode(HttpStatus.OK)
  invite(@Param('id') id: number) {
    return this.partnerService.invite(Number(id));
  }
}

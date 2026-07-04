import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { PricesService } from '../services/prices.service';
import { CreatePriceDto } from '../dto/create-price.dto';

@ApiTags('Stripe')
@UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'stripe/prices',
  version: '1',
})
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  findByProduct(@Query('productId') productId: string) {
    return this.pricesService.findByProduct(productId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(RoleEnum.admin)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePriceDto) {
    return this.pricesService.create(dto);
  }
}

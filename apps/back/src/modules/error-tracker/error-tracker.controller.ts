import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Delete,
  Param,
  Patch,
  Query,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorTrackerService } from './error-tracker.service';
import { CreateErrorDto } from './dto/create-error.dto';
import { JwtAuthGuard } from '../iam/auth/guards';
import { RolesGuard } from '../iam/roles/roles.guard';
import { Roles } from '../iam/roles/roles.decorator';
import { RoleEnum } from '../iam/roles/roles.enum';

@ApiTags('Error Tracker')
@Controller({ path: 'system/errors', version: '1' })
export class ErrorTrackerController {
  private readonly logger = new Logger('ErrorTrackerController');

  constructor(
    private readonly errorTrackerService: ErrorTrackerService,
  ) {}

  @Post()
  async reportError(@Body() dto: CreateErrorDto) {
    await this.errorTrackerService.logError(dto);
    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.admin)
  @Get()
  async getAllErrors() {
    return this.errorTrackerService.findAll();
  }

  // ─── Existing endpoints ───────────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.admin)
  @Delete('resolved')
  async deleteResolvedErrors() {
    await this.errorTrackerService.deleteResolved();
    return { success: true, message: 'Resolved errors cleared' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.admin)
  @Delete()
  async clearAllErrors() {
    await this.errorTrackerService.deleteAll();
    return { success: true, message: 'All errors cleared' };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.admin)
  @Patch(':id/resolve')
  async markAsResolved(@Param('id') id: string) {
    await this.errorTrackerService.markAsResolved(id);
    return { success: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleEnum.admin)
  @Delete(':id')
  async deleteError(@Param('id') id: string) {
    await this.errorTrackerService.deleteOne(id);
    return { success: true };
  }
}

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { AutodmService } from '@ext/upload-post/services/autodm.service';
import {
  StartAutodmDto,
  AutodmMonitorIdDto,
  AutodmStatusDto,
  AutodmLogsDto,
} from '@ext/upload-post/dto/autodm.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/autodms', version: '1' })
export class AutodmController {
  constructor(private readonly autodmService: AutodmService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  start(@Body() dto: StartAutodmDto) {
    return this.autodmService.startMonitor(dto);
  }

  @Get('status')
  getStatus(@Query() query: AutodmStatusDto) {
    return this.autodmService.getStatus(query.includeInactive ?? false);
  }

  @Get('logs')
  getLogs(@Query() query: AutodmLogsDto) {
    return this.autodmService.getLogs(query.monitorId);
  }

  @Post('pause')
  @HttpCode(HttpStatus.OK)
  pause(@Body() dto: AutodmMonitorIdDto) {
    return this.autodmService.pause(dto.monitorId);
  }

  @Post('resume')
  @HttpCode(HttpStatus.OK)
  resume(@Body() dto: AutodmMonitorIdDto) {
    return this.autodmService.resume(dto.monitorId);
  }

  @Post('stop')
  @HttpCode(HttpStatus.OK)
  stop(@Body() dto: AutodmMonitorIdDto) {
    return this.autodmService.stop(dto.monitorId);
  }

  @Post('delete')
  @HttpCode(HttpStatus.OK)
  delete(@Body() dto: AutodmMonitorIdDto) {
    return this.autodmService.delete(dto.monitorId);
  }

  @Get('local')
  getLocalMonitors() {
    return this.autodmService.getLocalMonitors();
  }
}
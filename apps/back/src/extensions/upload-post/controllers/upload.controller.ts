import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { UploadService } from '@ext/upload-post/services/upload.service';
import {
  UploadVideoDto,
  UploadPhotosDto,
  UploadTextDto,
  UploadStatusDto,
} from '@ext/upload-post/dto/upload.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/upload', version: '1' })
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('video')
  @HttpCode(HttpStatus.ACCEPTED)
  uploadVideo(@Body() dto: UploadVideoDto) {
    return this.uploadService.uploadVideo(dto);
  }

  @Post('photo')
  @HttpCode(HttpStatus.ACCEPTED)
  uploadPhotos(@Body() dto: UploadPhotosDto) {
    return this.uploadService.uploadPhotos(dto);
  }

  @Post('text')
  @HttpCode(HttpStatus.ACCEPTED)
  uploadText(@Body() dto: UploadTextDto) {
    return this.uploadService.uploadText(dto);
  }

  @Get('status')
  getUploadStatus(@Query() query: UploadStatusDto) {
    return this.uploadService.checkStatus(query);
  }

  @Get('history')
  getHistory() {
    return this.uploadService.getHistory();
  }

  @Get('local')
  getLocalPosts() {
    return this.uploadService.getLocalPosts();
  }
}
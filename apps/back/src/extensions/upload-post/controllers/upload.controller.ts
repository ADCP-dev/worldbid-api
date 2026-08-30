import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Express } from 'express';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';
import { UploadService } from '@ext/upload-post/services/upload.service';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import {
  UploadVideoDto,
  UploadPhotosDto,
  UploadTextDto,
  UploadStatusDto,
  UploadDocumentDto,
} from '@ext/upload-post/dto/upload.dto';
import {
  RetryUploadDto,
  UnpublishDto,
} from '@ext/upload-post/dto/upload-actions.dto';

@ApiTags('Upload-Post')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'upload-post/upload', version: '1' })
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly client: UploadPostClientService,
  ) {}

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

  @Post('document')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.ACCEPTED)
  uploadDocument(
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!dto.documentUrl && !file) {
      throw new BadRequestException(
        'Provide documentUrl or a multipart "file" field',
      );
    }
    return this.uploadService.uploadDocument({
      user: dto.user,
      platforms: dto.platforms,
      documentUrl: dto.documentUrl,
      documentBuffer: file?.buffer,
      documentFilename: file?.originalname,
      title: dto.title,
      caption: dto.caption,
      scheduledDate: dto.scheduledDate,
      addToQueue: dto.addToQueue,
    });
  }

  @Post('actions/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  retryUpload(@Body() dto: RetryUploadDto) {
    if (!dto.requestId && !dto.jobId) {
      throw new BadRequestException('requestId or jobId is required');
    }
    return this.client.retryUpload({
      requestId: dto.requestId,
      jobId: dto.jobId,
    });
  }

  @Post('actions/unpublish')
  @HttpCode(HttpStatus.ACCEPTED)
  unpublishPost(@Body() dto: UnpublishDto) {
    return this.client.unpublishPost({
      platform: dto.platform as
        | 'facebook'
        | 'youtube'
        | 'x'
        | 'linkedin'
        | 'threads',
      postId: dto.postId,
    });
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

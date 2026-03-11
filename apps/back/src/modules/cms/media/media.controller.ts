import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
  HttpCode,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { ApiBearerAuth, ApiTags, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '@iam/roles/roles.guard';
import { FileUploadDto } from '@storage/files/dto/file-upload.dto';
import { FilesLocalService } from '@storage/files/infrastructure/uploader/local/files.service';
import { UserId } from '@iam/auth/decorators/current-user.decorator';

@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiTags('CMS Media')
@Controller({
  path: 'cms/media',
  version: '1',
})
export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly filesService: FilesLocalService,
  ) {}

  @Post('upload')
  @Roles(RoleEnum.admin)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        entityName: {
          type: 'string',
          description: 'Entity name (e.g., BlogPost, Page)',
        },
        entityId: { type: 'string', description: 'Entity ID (UUID)' },
        context: {
          type: 'string',
          description: 'Context (e.g., content, featured)',
        },
        isPublic: { type: 'boolean', default: true },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: FileUploadDto,
    @UserId() userId: number,
  ) {
    const result = await this.filesService.create(
      file,
      {
        ...body,
        isPublic: body.isPublic !== false,
      },
      userId,
    );

    const baseUrl = process.env.API_URL || 'http://localhost:3001';

    return {
      url: `${baseUrl}${result.file.path}`,
      id: result.file.id,
      name: result.file.name,
      entityName: result.file.entityName,
      entityId: result.file.entityId,
    };
  }
}

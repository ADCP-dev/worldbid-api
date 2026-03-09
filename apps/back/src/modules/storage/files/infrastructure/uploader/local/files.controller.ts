import {
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  Response,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiExcludeEndpoint,
  ApiTags,
  ApiParam,
  ApiOperation,
  ApiOkResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FilesLocalService } from '@storage/files/infrastructure/uploader/local/files.service';
import { FileResponseDto } from '@storage/files/infrastructure/uploader/local/dto/file-response.dto';
import { FileUploadDto } from '@storage/files/dto/file-upload.dto';
import { FilesService } from '@storage/files/files.service';
import { FileFilterDto } from '@storage/files/dto/file-filter.dto';
import { FileType } from '@storage/files/domain/file';
import { UserId } from '@iam/auth/decorators/current-user.decorator';
import { ImageProcessingService } from '@storage/files/infrastructure/image-processing/image-processing.service';

@ApiTags('Files')
@Controller({
  path: 'files',
  version: '1',
})
export class FilesLocalController {
  constructor(
    private readonly filesService: FilesLocalService,
    private readonly filesGenericService: FilesService,
    private readonly imageProcessingService: ImageProcessingService,
  ) {}

  @ApiOkResponse({
    type: [FileType],
    description: 'Files retrieved successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get()
  @ApiOperation({ summary: 'Get files with optional filters' })
  async getFiles(
    @Query() filters: FileFilterDto,
    @UserId() userId: number,
  ): Promise<FileType[]> {
    try {
      return await this.filesGenericService.findWithFilters({
        ...filters,
        userId,
      });
    } catch (error) {
      if (
        error.message ===
        'Entity parameter is required when entityId is provided'
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @ApiCreatedResponse({
    type: FileResponseDto,
    description: 'File uploaded successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        isPublic: {
          type: 'boolean',
          default: true,
          description: 'Whether the file should be publicly accessible',
        },
        entity: {
          type: 'string',
          description:
            'Entity name where the file is associated (e.g., "users")',
        },
        entityId: {
          type: 'string',
          description: 'Entity ID where the file is associated (e.g., UUID)',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload a new file' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: FileUploadDto,
    @UserId() userId: number,
  ): Promise<FileResponseDto> {
    return this.filesService.create(file, body, userId);
  }

  @ApiOkResponse({
    type: FileResponseDto,
    description: 'File updated successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        isPublic: {
          type: 'boolean',
          description: 'Whether the file should be publicly accessible',
        },
        destination: {
          type: 'string',
          description:
            'Optional subfolder to save the file in (e.g., "users/avatars")',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Update an existing file' })
  @UseInterceptors(FileInterceptor('file'))
  async updateFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('isPublic') isPublic?: boolean,
    @Body('destination') destination?: string,
  ): Promise<FileResponseDto> {
    return this.filesService.update(id, file, isPublic, destination);
  }

  @ApiNoContentResponse({ description: 'File deleted successfully' })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  @ApiParam({ name: 'id', description: 'File ID' })
  @ApiOperation({ summary: 'Delete a file' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(@Param('id') id: string): Promise<void> {
    return this.filesService.delete(id);
  }

  /**
   * Stateless image optimization endpoint.
   * Accepts any image file, returns the optimized WebP bytes directly.
   * The file is NOT stored — useful for client-side preview or on-the-fly optimization.
   */
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Post('optimize')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Optimize an image and return it directly (no storage)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async optimizeImage(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<StreamableFile> {
    if (!file?.buffer) {
      throw new BadRequestException('No file provided');
    }
    if (!this.imageProcessingService.isImage(file.mimetype)) {
      throw new BadRequestException('Only image files can be optimized');
    }
    const processed = await this.imageProcessingService.processImage(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    const outputName = this.imageProcessingService.getOptimizedFilename(
      file.originalname,
    );
    return new StreamableFile(processed.buffer, {
      type: 'image/webp',
      disposition: `attachment; filename="${outputName}"`,
    });
  }

  @Get('public/*path')
  @ApiExcludeEndpoint()
  downloadPublic(@Param('path') path: Array<string>, @Response() response) {
    console.log(path);
    return response.sendFile(path.join('/'), { root: './files/public' });
  }

  @Get('private/*path')
  @ApiExcludeEndpoint()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  downloadPrivate(@Param('path') path: Array<string>, @Response() response) {
    return response.sendFile(path.join('/'), { root: './files/private' });
  }
}

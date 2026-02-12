import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Get,
  Param,
  Put,
  Delete,
  Body,
  Query,
  BadRequestException,
  Response,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiTags,
  ApiOkResponse,
  ApiParam,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FilesS3Service } from './files.service';
import { FileResponseDto } from './dto/file-response.dto';
import { FileUploadDto } from '../../../dto/file-upload.dto';
import { FilesService } from '../../../files.service';
import { FileFilterDto } from '../../../dto/file-filter.dto';
import { FileType } from '../../../domain/file';
import { UserId } from '../../../../auth/decorators/current-user.decorator';

@ApiTags('Files')
@Controller({
  path: 'files',
  version: '1',
})
export class FilesS3Controller {
  constructor(
    private readonly filesService: FilesS3Service,
    private readonly filesGenericService: FilesService,
  ) {}

  @ApiOkResponse({
    type: [FileType],
    description: 'Files retrieved successfully',
  })
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get()
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.MulterS3.File,
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
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async updateFile(
    @Param('id') id: string,
    @UploadedFile() file: Express.MulterS3.File,
    @Body('isPublic') isPublic?: boolean,
  ): Promise<FileResponseDto> {
    return this.filesService.update(id, file, isPublic);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteFile(@Param('id') id: string): Promise<void> {
    return this.filesService.delete(id);
  }

  @Get('public/*path')
  @ApiExcludeEndpoint()
  async downloadPublic(
    @Param('path') path: Array<string>,
    @Response() response,
  ) {
    const key = path.join('/');
    const url = await this.filesService.getPublicUrl(key);
    return response.redirect(url);
  }

  @Get('private/*path')
  @ApiExcludeEndpoint()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  async downloadPrivate(
    @Param('path') path: Array<string>,
    @Response() response,
  ) {
    const key = path.join('/');
    const url = await this.filesService.getPresignedUrl(key);
    return response.redirect(url);
  }
}

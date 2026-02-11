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
  ParseBoolPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
import { FilesLocalService } from './files.service';
import { FileResponseDto } from './dto/file-response.dto';
import { FileUploadDto } from './dto/file-upload.dto';
import { FilesService } from '../../../files.service';
import { FileFilterDto } from '../../../dto/file-filter.dto';
import { FileType } from '../../../domain/file';
import { UserId } from '../../../../auth/decorators/current-user.decorator';

@ApiTags('Files')
@Controller({
  path: 'files',
  version: '1',
})
export class FilesLocalController {
  constructor(
    private readonly filesService: FilesLocalService,
    private readonly filesGenericService: FilesService,
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
          type: 'integer',
          description: 'Entity ID where the file is associated (e.g., "123")',
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

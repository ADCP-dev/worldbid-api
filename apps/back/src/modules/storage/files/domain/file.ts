import { ApiProperty } from '@nestjs/swagger';
import { Allow } from 'class-validator';
import { Transform } from 'class-transformer';

import { AppConfig } from '@src/config/app-config.type';
import appConfig from '@src/config/app.config';

export class FileType {
  @ApiProperty({
    type: String,
    example: 'cbcfa8b8-3a25-4adb-a9c6-e325f0d0f3ae',
  })
  @Allow()
  id: string;

  @ApiProperty({
    type: String,
    example: 'https://example.com/path/to/file.jpg',
  })
  @Transform(
    ({ value, obj }) => {
      if (value) {
        if (value.startsWith('http')) {
          return value;
        }

        const appConfigData = appConfig() as AppConfig;
        const apiPrefix = appConfigData.apiPrefix;
        const version = 'v1'; // Matching controller version
        const backendDomain = appConfigData.backendDomain.endsWith('/')
          ? appConfigData.backendDomain.slice(0, -1)
          : appConfigData.backendDomain;

        let path = value;
        const fullPrefix = `${apiPrefix}/${version}/files/`;

        // If the path already includes the API prefix, just prepend the domain
        if (path.includes(fullPrefix)) {
          if (!path.startsWith('/')) {
            path = `/${path}`;
          }
          return `${backendDomain}${path}`;
        }

        // Otherwise, construct the full API path (assume value is just the relative path/filename)
        if (path.startsWith('/')) {
          path = path.slice(1);
        }

        return `${backendDomain}/${apiPrefix}/${version}/files/${
          obj.isPublic ? 'public' : 'private'
        }/${path}`;
      }
      return value;
    },
    {
      toPlainOnly: true,
    },
  )
  path: string;

  @ApiProperty({
    type: Boolean,
    example: true,
    description:
      'Whether the file is publicly accessible or requires authentication',
    default: true,
  })
  @Allow()
  isPublic: boolean;

  @ApiProperty({
    type: String,
    example: 'user',
    description: 'Entity type that owns this file',
    required: false,
  })
  @Allow()
  entity?: string;

  @ApiProperty({
    type: String,
    example: 'c7f7992f-7d1b-4d93-8f1b-9c2b8b9a6b13',
    description: 'ID of the entity that owns this file',
    required: false,
  })
  @Allow()
  entityId?: string;

  @ApiProperty({
    type: Number,
    example: 1,
    description: 'ID of the user who uploaded this file',
    required: false,
  })
  @Allow()
  userId?: number;

  @ApiProperty({
    type: String,
    example: 'image/jpeg',
    description: 'MIME type of the file',
  })
  @Allow()
  type: string;

  @ApiProperty({
    type: Number,
    example: 1024,
    description: 'File size in bytes',
  })
  @Allow()
  size: number;

  @ApiProperty({
    type: String,
    example: 'image.jpg',
    description: 'File name',
  })
  @Allow()
  name: string;
}

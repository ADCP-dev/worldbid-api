import { registerAs } from '@nestjs/config';

import { IsEnum, IsString, ValidateIf, IsNotEmpty } from 'class-validator';
import validateConfig from '@infra/utils/validate-config';
import { FileDriver, FileConfig } from '@storage/files/config/file-config.type';

class EnvironmentVariablesValidator {
  @IsEnum(FileDriver)
  FILE_DRIVER: FileDriver;

  @ValidateIf((envValues) =>
    [FileDriver.S3, FileDriver.S3_PRESIGNED].includes(envValues.FILE_DRIVER),
  )
  @IsString()
  ACCESS_KEY_ID: string;

  @ValidateIf((envValues) =>
    [FileDriver.S3, FileDriver.S3_PRESIGNED].includes(envValues.FILE_DRIVER),
  )
  @IsString()
  SECRET_ACCESS_KEY: string;

  @ValidateIf((envValues) =>
    [FileDriver.S3, FileDriver.S3_PRESIGNED].includes(envValues.FILE_DRIVER),
  )
  @IsString()
  @IsNotEmpty()
  AWS_DEFAULT_S3_BUCKET: string;

  @ValidateIf((envValues) =>
    [FileDriver.S3, FileDriver.S3_PRESIGNED].includes(envValues.FILE_DRIVER),
  )
  @IsString()
  AWS_S3_REGION: string;

  @ValidateIf((envValues) => envValues.FILE_DRIVER === FileDriver.S3)
  @IsString()
  AWS_S3_ENDPOINT: string;

  // B2 uses S3 endpoint — no separate B2 config needed
}

export default registerAs<FileConfig>('file', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    driver:
      (process.env.FILE_DRIVER as FileDriver | undefined) ?? FileDriver.LOCAL,
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    awsDefaultS3Bucket: process.env.AWS_DEFAULT_S3_BUCKET,
    awsS3Region: process.env.AWS_S3_REGION,
    awsS3Endpoint: process.env.AWS_S3_ENDPOINT,
    maxFileSize: 20971520, // 20mb
    imageOptimizationEnabled:
      process.env.IMAGE_OPTIMIZATION_ENABLED !== 'false',
    imageOptimizationQuality: parseInt(
      process.env.IMAGE_OPTIMIZATION_QUALITY ?? '80',
      10,
    ),
    imageOptimizationMaxWidth: parseInt(
      process.env.IMAGE_OPTIMIZATION_MAX_WIDTH ?? '1920',
      10,
    ),
    imageOptimizationMaxHeight: parseInt(
      process.env.IMAGE_OPTIMIZATION_MAX_HEIGHT ?? '1080',
      10,
    ),
  };
});

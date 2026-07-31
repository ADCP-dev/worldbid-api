export enum FileDriver {
  LOCAL = 'local',
  S3 = 's3',
  S3_PRESIGNED = 's3-presigned',
  // Backblaze B2 is S3-compatible — use S3 or S3_PRESIGNED with B2 endpoint
}

export type FileConfig = {
  driver: FileDriver;
  accessKeyId?: string;
  secretAccessKey?: string;
  awsDefaultS3Bucket?: string;
  awsS3Region?: string;
  awsS3Endpoint?: string;
  maxFileSize: number;
  imageOptimizationEnabled: boolean;
  imageOptimizationQuality: number;
  imageOptimizationMaxWidth: number;
  imageOptimizationMaxHeight: number;
};

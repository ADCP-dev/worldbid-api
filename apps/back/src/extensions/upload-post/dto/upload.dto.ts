import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsBoolean } from 'class-validator';

export class UploadVideoDto {
  @ApiProperty({ example: 'Mi video título' })
  @IsString()
  title: string;

  @ApiProperty({ example: ['instagram', 'tiktok', 'youtube'] })
  @IsArray()
  @IsString({ each: true })
  platforms: string[];

  @ApiProperty({ example: 'https://s3.bucket/video.mp4', required: false })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileUsername?: string;

  @ApiProperty({ required: false, description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsString()
  scheduledDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  thumbUrl?: string;

  @ApiProperty({ required: false, description: 'reels | video' })
  @IsOptional()
  @IsString()
  facebookMediaType?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  youtubeCategory?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  youtubeTags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pinterestBoard?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  redditSubreddit?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  redditTitle?: string;
}

export class UploadPhotosDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ example: ['instagram', 'pinterest'] })
  @IsArray()
  @IsString({ each: true })
  platforms: string[];

  @ApiProperty({ required: false, type: [String], description: 'Array of photo URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileUsername?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  scheduledDate?: string;
}

export class UploadTextDto {
  @ApiProperty()
  @IsString()
  user: string;

  @ApiProperty({ example: ['x', 'threads', 'bluesky'] })
  @IsArray()
  @IsString({ each: true })
  platforms: string[];

  @ApiProperty()
  @IsString()
  text: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  scheduledDate?: string;
}

export class UploadStatusDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  jobId?: string;
}
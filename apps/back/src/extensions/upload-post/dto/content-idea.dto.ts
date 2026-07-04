import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, IsEnum, IsInt } from 'class-validator';

export class CreateContentIdeaDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: ['idea', 'drafting', 'ready', 'scheduled', 'published'], default: 'idea' })
  @IsOptional()
  @IsEnum(['idea', 'drafting', 'ready', 'scheduled', 'published'])
  status?: string;

  @ApiProperty({ required: false, enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ required: false, description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class UpdateContentIdeaDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false, enum: ['idea', 'drafting', 'ready', 'scheduled', 'published'] })
  @IsOptional()
  @IsEnum(['idea', 'drafting', 'ready', 'scheduled', 'published'])
  status?: string;

  @ApiProperty({ required: false, enum: ['low', 'medium', 'high'] })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ required: false, description: 'ISO 8601 datetime' })
  @IsOptional()
  @IsString()
  scheduledAt?: string;
}

export class ReorderIdeasDto {
  @ApiProperty({ type: [String], description: 'Ordered array of idea IDs' })
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}
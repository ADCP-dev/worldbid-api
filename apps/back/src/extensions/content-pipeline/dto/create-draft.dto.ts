import { IsString, IsOptional, IsObject, IsArray } from 'class-validator';

export class CreateDraftDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  ideaId?: string;

  @IsOptional()
  @IsString()
  blogContent?: string;

  @IsOptional()
  @IsObject()
  seoMetadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  socialVariants?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  images?: Record<string, unknown>[];

  @IsOptional()
  @IsArray()
  affiliateLinks?: Record<string, unknown>[];
}
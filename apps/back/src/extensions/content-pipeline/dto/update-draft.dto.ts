import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsObject, IsArray } from 'class-validator';
import { CreateDraftDto } from './create-draft.dto';

export class UpdateDraftDto extends PartialType(
  OmitType(CreateDraftDto, ['projectId', 'ideaId'] as const),
) {
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

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsString()
  lookupKey: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}

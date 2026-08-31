import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class PlaceBidDto {
  /** ISO-3166-1 alpha-2 code, or 'PLANE' for the global banner spot. */
  @IsString()
  @Matches(/^[A-Z]{2,5}$/, {
    message: 'countryId must be an ISO2 code or PLANE.',
  })
  countryId: string;

  /** Public display name (alias). */
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  alias: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsString()
  @Matches(/^https?:\/\/.+/, { message: 'url must be an http(s) URL.' })
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pitch?: string;

  /** USD amount. Must be >= the tiered minimum (server-enforced). */
  @IsNumber({ maxDecimalPoints: 2 } as any)
  @Min(0.01)
  amount: number;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentColor?: string;
}
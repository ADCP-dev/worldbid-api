import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModelDto {
  @ApiProperty({ type: String, description: 'UUID of the parent provider' })
  @IsString()
  @MaxLength(255)
  providerId: string;

  @ApiProperty({ type: String, description: 'Provider-specific model id, e.g. "glm-5.2"' })
  @IsString()
  @MaxLength(255)
  modelId: string;

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(255)
  displayName: string;

  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  contextWindow: number;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * One file attached to a chat message. `data` is raw base64 (no data: URL
 * prefix). Text-like files are decoded server-side and inlined into the
 * prompt; images/PDFs/audio are passed as multimodal content blocks when the
 * model supports them.
 */
export class MessageAttachmentDto {
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(128)
  mimeType: string;

  /** Raw base64 payload (no `data:` prefix). */
  @ApiProperty({ type: String })
  @IsString()
  @MaxLength(20_000_000) // ~15 MB binary
  data: string;
}

export class SendMessageDto {
  @ApiProperty({ type: String, maxLength: 32000 })
  @IsString()
  @MaxLength(32000)
  message: string;

  @ApiPropertyOptional({ type: [MessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageAttachmentDto)
  attachments?: MessageAttachmentDto[];
}

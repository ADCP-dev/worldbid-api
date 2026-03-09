import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { AllConfigType } from '@src/config/config.type';

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  size: number;
  width: number;
  height: number;
}

@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);

  // Supported image MIME types for optimization
  private static readonly OPTIMIZABLE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/bmp',
  ];

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /**
   * Returns true if the given MIME type is an optimizable image.
   */
  isImage(mimeType: string): boolean {
    return ImageProcessingService.OPTIMIZABLE_TYPES.includes(
      mimeType?.toLowerCase(),
    );
  }

  /**
   * Replaces the file extension with .webp for the optimized output filename.
   */
  getOptimizedFilename(originalName: string): string {
    const dotIndex = originalName.lastIndexOf('.');
    const base =
      dotIndex >= 0 ? originalName.substring(0, dotIndex) : originalName;
    return `${base}.webp`;
  }

  /**
   * Processes an image buffer through Sharp:
   * - Converts to WebP for optimal compression
   * - Resizes to configured max dimensions (maintaining aspect ratio)
   * - Applies configured quality
   *
   * Non-image buffers are returned unchanged.
   */
  async processImage(
    buffer: Buffer,
    mimeType: string,
    filename?: string,
  ): Promise<ProcessedImage> {
    if (!this.isImage(mimeType)) {
      return {
        buffer,
        mimeType,
        size: buffer.length,
        width: 0,
        height: 0,
      };
    }

    // Read optimization config with defaults
    const quality =
      (this.configService.get('file.imageOptimizationQuality', {
        infer: true,
      }) as number | undefined) ?? 80;

    const maxWidth =
      (this.configService.get('file.imageOptimizationMaxWidth', {
        infer: true,
      }) as number | undefined) ?? 1920;

    const maxHeight =
      (this.configService.get('file.imageOptimizationMaxHeight', {
        infer: true,
      }) as number | undefined) ?? 1080;

    this.logger.log(
      `Optimizing image${filename ? ` "${filename}"` : ''}: quality=${quality}, maxWidth=${maxWidth}, maxHeight=${maxHeight}`,
    );

    const { data, info } = await sharp(buffer)
      .rotate() // auto-rotate based on EXIF orientation
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: 'inside', // never upscale, maintain aspect ratio
        withoutEnlargement: true,
      })
      .webp({ quality })
      .toBuffer({ resolveWithObject: true });

    this.logger.log(
      `Image optimized: ${buffer.length} bytes → ${data.length} bytes (${info.width}x${info.height})`,
    );

    return {
      buffer: data,
      mimeType: 'image/webp',
      size: data.length,
      width: info.width,
      height: info.height,
    };
  }

  /**
   * Re-optimizes an image from a file path (for manual re-optimization).
   */
  async processImageFromFile(filePath: string): Promise<ProcessedImage> {
    const { data, info } = await sharp(filePath)
      .rotate()
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      mimeType: 'image/webp',
      size: data.length,
      width: info.width,
      height: info.height,
    };
  }
}

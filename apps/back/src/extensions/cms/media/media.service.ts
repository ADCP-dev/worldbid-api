import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(FileEntity)
    private readonly fileRepository: Repository<FileEntity>,
  ) {}

  async findByEntity(
    entityName: string,
    entityId: string,
  ): Promise<FileEntity[]> {
    const where: FindOptionsWhere<FileEntity> = {};

    if (entityName) {
      where.entityName = entityName;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    return this.fileRepository.find({ where });
  }

  async createImage(
    file: Express.Multer.File,
  ): Promise<{ url: string; id: string; name: string }> {
    const savedFile = await this.fileRepository.save({
      path: file.path || `/uploads/${file.originalname}`,
      name: file.originalname,
      isPublic: true,
      entityName: 'CmsMedia',
      context: 'inline',
      type: file.mimetype,
      size: file.size,
    } as any);

    const baseUrl = process.env.API_URL || 'http://localhost:3001';

    return {
      url: `${baseUrl}/api/v1/files/public/${savedFile.id}`,
      id: savedFile.id,
      name: savedFile.name,
    };
  }
}

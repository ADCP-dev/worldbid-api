import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLogEntity } from './entities/error-log.entity';
import { CreateErrorDto } from './dto/create-error.dto';
import * as crypto from 'crypto';

@Injectable()
export class ErrorTrackerService {
  constructor(
    @InjectRepository(ErrorLogEntity)
    private errorLogRepo: Repository<ErrorLogEntity>,
  ) {}

  private generateHash(
    message: string,
    source: string,
    stack?: string,
  ): string {
    const stackSnippet = stack ? stack.substring(0, 200) : '';
    const rawString = `${message}-${source}-${stackSnippet}`;
    return crypto.createHash('sha256').update(rawString).digest('hex');
  }

  async logError(dto: CreateErrorDto): Promise<ErrorLogEntity> {
    const hash = this.generateHash(dto.message, dto.source || '', dto.stack);

    const existingError = await this.errorLogRepo.findOne({
      where: { hash, resolved: false },
    });

    if (existingError) {
      existingError.occurrences += 1;
      existingError.lastOccurredAt = new Date();
      return this.errorLogRepo.save(existingError);
    }

    const newError = this.errorLogRepo.create({
      ...dto,
      hash,
      occurrences: 1,
      resolved: false,
      resolvedAt: null,
      firstOccurredAt: new Date(),
      lastOccurredAt: new Date(),
    });

    return this.errorLogRepo.save(newError);
  }

  async findAll(): Promise<ErrorLogEntity[]> {
    return this.errorLogRepo.find({
      order: { lastOccurredAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<ErrorLogEntity | null> {
    return this.errorLogRepo.findOne({ where: { id } });
  }

  async markAsResolved(id: string): Promise<ErrorLogEntity | null> {
    const error = await this.errorLogRepo.findOne({ where: { id } });
    if (error) {
      error.resolved = true;
      error.resolvedAt = new Date();
      return this.errorLogRepo.save(error);
    }
    return null;
  }

  async deleteOne(id: string): Promise<void> {
    await this.errorLogRepo.delete({ id });
  }

  async deleteAll(): Promise<void> {
    await this.errorLogRepo.createQueryBuilder().delete().execute();
  }

  async deleteResolved(): Promise<void> {
    await this.errorLogRepo.delete({ resolved: true });
  }
}

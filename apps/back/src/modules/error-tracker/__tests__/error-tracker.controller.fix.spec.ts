import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { ErrorTrackerController } from '../error-tracker.controller';
import { ErrorTrackerService } from '../error-tracker.service';
import { FixLogEntity } from '@core/spec-engine/auto-fix-log.entity';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeFixLog(overrides: Partial<FixLogEntity> = {}): FixLogEntity {
  return {
    id: 'fix-1',
    errorId: 'err-1',
    errorHash: 'hash-1',
    status: 'applied',
    confidence: 'high',
    fixType: 'spec_fix',
    changes: [],
    testResult: null,
    prUrl: null,
    reason: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ErrorTrackerController — auto-fix endpoints', () => {
  let controller: ErrorTrackerController;
  let errorTrackerService: { findOne: ReturnType<typeof vi.fn>; markAsResolved: ReturnType<typeof vi.fn> };
  let fixLogRepo: {
    findOne: ReturnType<typeof vi.fn>;
    findAndCount: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    errorTrackerService = {
      findOne: vi.fn(),
      markAsResolved: vi.fn().mockResolvedValue(undefined),
    };
    fixLogRepo = {
      findOne: vi.fn(),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ErrorTrackerController],
      providers: [
        { provide: ErrorTrackerService, useValue: errorTrackerService },
        {
          provide: getRepositoryToken(FixLogEntity),
          useValue: fixLogRepo,
        },
      ],
    }).compile();

    controller = module.get(ErrorTrackerController);
  });

  describe('GET /fixes/history', () => {
    it('should return paginated fix history', async () => {
      const logs = [makeFixLog(), makeFixLog({ id: 'fix-2' })];
      fixLogRepo.findAndCount.mockResolvedValue([logs, 2]);
      const result = await controller.getFixHistory('10', '0');
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    it('should use defaults when no query params', async () => {
      fixLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await controller.getFixHistory();
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
    });

    it('should cap limit at 100', async () => {
      fixLogRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await controller.getFixHistory('500', '0');
      expect(result.limit).toBe(100);
    });
  });

  describe('GET /:id/fix', () => {
    it('should return latest fix log for error', async () => {
      const log = makeFixLog();
      fixLogRepo.findOne.mockResolvedValue(log);
      const result = await controller.getFix('err-1');
      expect(result).toEqual(log);
    });

    it('should throw 404 when no fix log exists', async () => {
      fixLogRepo.findOne.mockResolvedValue(null);
      await expect(controller.getFix('err-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /:id/fix/apply', () => {
    it('should return message with latest fix when error exists', async () => {
      errorTrackerService.findOne.mockResolvedValue({ id: 'err-1' });
      const log = makeFixLog();
      fixLogRepo.findOne.mockResolvedValue(log);
      const result = await controller.applyFix('err-1');
      expect(result.errorId).toBe('err-1');
      expect(result.latestFix).toEqual(log);
    });

    it('should throw 404 when error does not exist', async () => {
      errorTrackerService.findOne.mockResolvedValue(null);
      await expect(controller.applyFix('err-999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /:id/fix/reject', () => {
    it('should mark error as resolved and return success', async () => {
      errorTrackerService.findOne.mockResolvedValue({ id: 'err-1' });
      const result = await controller.rejectFix('err-1');
      expect(result.success).toBe(true);
      expect(errorTrackerService.markAsResolved).toHaveBeenCalledWith('err-1');
    });

    it('should throw 404 when error does not exist', async () => {
      errorTrackerService.findOne.mockResolvedValue(null);
      await expect(controller.rejectFix('err-999')).rejects.toThrow(NotFoundException);
    });
  });
});
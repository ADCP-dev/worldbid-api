/**
 * db-branching.config — environment configuration for the database branching
 * subsystem (PRD 04).
 *
 * Read via `configService.get('dbBranching.*')`.
 */
import { registerAs } from '@nestjs/config';

export default registerAs('dbBranching', () => ({
  migrationsDir:
    process.env.MIGRATIONS_DIR ||
    'apps/back/src/infrastructure/database/migrations',
  agentId: process.env.AGENT_ID || 'manual',
  cleanupMaxAgeHours: parseInt(
    process.env.CLEANUP_MAX_AGE_HOURS || '24',
    10,
  ),
}));
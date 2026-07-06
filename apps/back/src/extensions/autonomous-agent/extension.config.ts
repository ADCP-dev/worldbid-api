import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';
import validateConfig from '@infra/utils/validate-config';
import { AutonomousAgentConfig } from '@ext/autonomous-agent/config/autonomous-agent-config.type';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  AUTONOMOUS_AGENT_QUEUE_PREFIX: string;

  @IsString()
  @IsOptional()
  AUTONOMOUS_AGENT_RESEARCH_CRON: string;

  @IsString()
  @IsOptional()
  AUTONOMOUS_AGENT_GENERATE_CRON: string;

  @IsString()
  @IsOptional()
  AUTONOMOUS_AGENT_PUBLISH_CRON: string;

  @IsString()
  @IsOptional()
  AUTONOMOUS_AGENT_METRICS_CRON: string;

  @IsString()
  @IsOptional()
  AUTONOMOUS_AGENT_NOTIFICATION_EMAIL: string;
}

export default registerAs<AutonomousAgentConfig>('autonomous-agent', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    queuePrefix: process.env.AUTONOMOUS_AGENT_QUEUE_PREFIX ?? 'aa',
    defaultResearchCron:
      process.env.AUTONOMOUS_AGENT_RESEARCH_CRON ?? '0 9 * * *',
    defaultGenerateCron:
      process.env.AUTONOMOUS_AGENT_GENERATE_CRON ?? '0 10 * * *',
    defaultPublishCron:
      process.env.AUTONOMOUS_AGENT_PUBLISH_CRON ?? '0 18 * * *',
    defaultMetricsCron:
      process.env.AUTONOMOUS_AGENT_METRICS_CRON ?? '0 9 * * 1',
    notificationEmail: process.env.AUTONOMOUS_AGENT_NOTIFICATION_EMAIL,
  };
});

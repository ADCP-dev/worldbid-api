import { Module, Type } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { EntitySchema } from 'typeorm';

import { AaConfigEntity } from '@ext/autonomous-agent/infrastructure/persistence/entities/aa-config.entity';
import { AaRunEntity } from '@ext/autonomous-agent/infrastructure/persistence/entities/aa-run.entity';

import { AgentConfigService } from '@ext/autonomous-agent/services/agent-config.service';
import { AgentRunService } from '@ext/autonomous-agent/services/agent-run.service';
import { PipelineOrchestratorService } from '@ext/autonomous-agent/services/pipeline-orchestrator.service';
import { FeedbackService } from '@ext/autonomous-agent/services/feedback.service';
import { NotificationService } from '@ext/autonomous-agent/services/notification.service';
import { SchedulerService } from '@ext/autonomous-agent/services/scheduler.service';
import { AutonomousAgentJobProcessor } from '@ext/autonomous-agent/services/job-processor';

import { AgentConfigController } from '@ext/autonomous-agent/controllers/agent-config.controller';
import { AgentRunController } from '@ext/autonomous-agent/controllers/agent-run.controller';

import { AUTONOMOUS_AGENT_QUEUE } from '@ext/autonomous-agent/services/pipeline-orchestrator.service';

/**
 * Soft dependency on the content-pipeline metrics entity.
 *
 * The content-pipeline extension may not be loaded at runtime, so we
 * import the entity symbol here but only register its repository when
 * the class actually resolves. If the import fails (extension missing),
 * the catch block leaves `cpMetricsEntity` undefined and we omit it
 * from TypeOrmModule.forFeature — FeedbackService then degrades to a
 * no-op via its @Optional() repository injection.
 */
let ContentPipelineMetricsEntity:
  | Type<unknown>
  | EntitySchema<unknown>
  | undefined;
try {
  ContentPipelineMetricsEntity =
    require('../content-pipeline/infrastructure/persistence/entities/metrics.entity').ContentPipelineMetricsEntity;
} catch {
  // content-pipeline extension not present — feedback loop becomes a no-op.
}

const entityTokens: (Type<unknown> | EntitySchema<unknown>)[] = [
  AaConfigEntity,
  AaRunEntity,
];
if (ContentPipelineMetricsEntity) {
  entityTokens.push(ContentPipelineMetricsEntity);
}

@Module({
  imports: [
    ConfigModule,
    // ScheduleModule.forRoot() is registered globally in infrastructure.module;
    // importing ScheduleModule here wires @Cron discovery into this module's
    // dependency graph without re-registering the scheduler.
    ScheduleModule,
    BullModule.registerQueue({ name: AUTONOMOUS_AGENT_QUEUE }),
    TypeOrmModule.forFeature(entityTokens),
  ],
  controllers: [AgentConfigController, AgentRunController],
  providers: [
    AgentConfigService,
    AgentRunService,
    PipelineOrchestratorService,
    FeedbackService,
    NotificationService,
    SchedulerService,
    AutonomousAgentJobProcessor,
  ],
  exports: [
    AgentConfigService,
    AgentRunService,
    PipelineOrchestratorService,
    FeedbackService,
    NotificationService,
  ],
})
export class AutonomousAgentExtensionModule {}

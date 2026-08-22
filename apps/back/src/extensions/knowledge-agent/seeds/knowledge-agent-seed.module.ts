import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModelProviderEntity } from '../infrastructure/entities/model-provider.entity';
import { ModelEntity } from '../infrastructure/entities/model.entity';
import { AgentConfigEntity } from '../infrastructure/entities/agent-config.entity';
import { KnowledgeAgentSeedService } from './knowledge-agent-seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModelProviderEntity,
      ModelEntity,
      AgentConfigEntity,
    ]),
  ],
  providers: [KnowledgeAgentSeedService],
  exports: [KnowledgeAgentSeedService],
})
export class KnowledgeAgentSeedModule {}
import { NestFactory } from '@nestjs/core';
import { RoleSeedService } from '@infra/database/seeds/role/role-seed.service';
import { SeedModule } from '@infra/database/seeds/seed.module';
import { StatusSeedService } from '@infra/database/seeds/status/status-seed.service';
import { UserSeedService } from '@infra/database/seeds/user/user-seed.service';
import { runExtensionSeeds } from '@src/core/seed-loader';

const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  // Core seeds
  await app.get(RoleSeedService).run();
  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();

  // Extension seeds (auto-discovered)
  await runExtensionSeeds(app);

  await app.close();
};

void runSeed();

// permissions.module.ts (recommended location)
import { Module } from '@nestjs/common';
import { OwnershipService } from './ownership.service';
import { PermissionsGuard } from './permissions.guard';

@Module({
  providers: [OwnershipService, PermissionsGuard],
  exports: [OwnershipService], // Export if used in other modules
})
export class PermissionsModule {}

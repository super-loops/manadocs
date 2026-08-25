import { Module } from '@nestjs/common';
import { SpaceService } from './services/space.service';
import { SpaceController } from './space.controller';
import { SpaceMemberService } from './services/space-member.service';
import { SpaceOverviewService } from './services/space-overview.service';
import { SpaceMaintenanceService } from './services/space-maintenance.service';

@Module({
  imports: [],
  controllers: [SpaceController],
  providers: [
    SpaceService,
    SpaceMemberService,
    SpaceOverviewService,
    SpaceMaintenanceService,
  ],
  exports: [SpaceService, SpaceMemberService],
})
export class SpaceModule {}

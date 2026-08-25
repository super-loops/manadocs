import { Module } from '@nestjs/common';
import { PageService } from './services/page.service';
import { PageController } from './page.controller';
import { PageVersionController } from './page-version.controller';
import { PageHistoryService } from './services/page-history.service';
import { PageVersionService } from './services/page-version.service';
import { TrashCleanupService } from './services/trash-cleanup.service';
import { WorkingChangesService } from './services/working-changes.service';
import { StorageModule } from '../../integrations/storage/storage.module';
import { CollaborationModule } from '../../collaboration/collaboration.module';
import { WatcherModule } from '../watcher/watcher.module';

@Module({
  controllers: [PageController, PageVersionController],
  providers: [
    PageService,
    PageHistoryService,
    PageVersionService,
    TrashCleanupService,
    WorkingChangesService,
  ],
  exports: [PageService, PageHistoryService, PageVersionService],
  imports: [StorageModule, CollaborationModule, WatcherModule],
})
export class PageModule {}

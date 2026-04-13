import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationProcessor } from './notification.processor';
import { PageNotificationService } from './services/page.notification';
import { ReviewNotificationService } from './services/review.notification';
import { PageUpdateEmailRateLimiter } from './services/page-update-email-rate-limiter';

@Module({
  imports: [],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationProcessor,
    PageNotificationService,
    ReviewNotificationService,
    PageUpdateEmailRateLimiter,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}

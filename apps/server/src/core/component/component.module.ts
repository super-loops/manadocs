import { forwardRef, Module } from '@nestjs/common';
import { AttachmentModule } from '../attachment/attachment.module';
import { CollaborationModule } from '../../collaboration/collaboration.module';
import { PageAccessModule } from '../page/page-access/page-access.module';
import { ApiTokenModule } from '../api-token/api-token.module';
import { ComponentService } from './component.service';
import {
  ComponentController,
  ComponentUploadController,
} from './component.controller';

@Module({
  imports: [
    forwardRef(() => AttachmentModule),
    CollaborationModule,
    PageAccessModule,
    ApiTokenModule,
  ],
  controllers: [ComponentController, ComponentUploadController],
  providers: [ComponentService],
  exports: [ComponentService],
})
export class ComponentModule {}

import { Module } from '@nestjs/common';
import { ApiTokenService } from './services/api-token.service';
import { ApiTokenController } from './api-token.controller';
import { ApiTokenRepo } from '@manadocs/db/repos/api-token/api-token.repo';
import { ApiTokenGuard } from './guards/api-token.guard';

@Module({
  controllers: [ApiTokenController],
  providers: [ApiTokenService, ApiTokenRepo, ApiTokenGuard],
  exports: [ApiTokenService, ApiTokenGuard],
})
export class ApiTokenModule {}

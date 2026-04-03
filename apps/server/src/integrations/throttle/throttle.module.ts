import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'auth', ttl: 60_000, limit: 10 }],
      errorMessage: 'Too many requests',
    }),
  ],
})
export class ThrottleModule {}

import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JobsController } from './jobs.controller';
import { ResultsController } from './results.controller';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { ScanController } from './scan.controller';
import { OrganizationsController } from './organizations.controller';
import { SchedulerController } from './scheduler.controller';
import { DashboardController } from './dashboard.controller';
import { JwtAuthGuard } from './auth.guard';
import { throttlerConfig } from './throttler.config';
import { CredentialsController } from './credentials.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot(throttlerConfig),
  ],
  controllers: [AppController, JobsController, ResultsController, SearchController, ScanController, OrganizationsController, SchedulerController, DashboardController, CredentialsController],
  providers: [
    AppService,
    SearchService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

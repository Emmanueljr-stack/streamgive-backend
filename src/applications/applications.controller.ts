import { Controller, Post, Body, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
// Import your application service and notification service

interface ApplicationRecord {
  id: string;
}

interface ApplicationsService {
  create(dto: unknown): Promise<ApplicationRecord>;
  review(id: string, dto: unknown): Promise<ApplicationRecord>;
}

interface NotificationService {
  notify(event: { type: string; targetId: string }): Promise<void>;
}

function errorDetails(error: unknown): { message: string; stack?: string } {
  return error instanceof Error
    ? { message: error.message, stack: error.stack }
    : { message: String(error) };
}

@Controller('applications')
export class ApplicationsController {
  private readonly logger = new Logger(ApplicationsController.name);

  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly notificationService: NotificationService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createApplication(@Body() createDto: unknown) {
    // 1. Commit application creation
    const application = await this.applicationsService.create(createDto);

    // 2. Trigger notification with non-blocking error catching
    try {
      await this.notificationService.notify({
        type: 'application_created',
        targetId: application.id,
      });
    } catch (error) {
      const { message, stack } = errorDetails(error);
      this.logger.error(`Failed to record notification log for application ${application.id}: ${message}`, stack);
    }

    return application;
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  async reviewApplication(@Param('id') id: string, @Body() reviewDto: unknown) {
    // 1. Commit application review update
    const updatedApplication = await this.applicationsService.review(id, reviewDto);

    // 2. Trigger notification with non-blocking error catching
    try {
      await this.notificationService.notify({
        type: 'application_reviewed',
        targetId: updatedApplication.id,
      });
    } catch (error) {
      const { message, stack } = errorDetails(error);
      this.logger.error(`Failed to record notification log for application review ${updatedApplication.id}: ${message}`, stack);
    }

    return updatedApplication;
  }
}
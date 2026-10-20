import { Logger } from '@nestjs/common';

export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  async notifyWebhook(webhookUrl: string, payload: unknown): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Redact URL path to prevent leaking Slack/Discord webhook secrets
        let redactedOrigin = 'unknown-origin';
        try {
          const parsedUrl = new URL(webhookUrl);
          redactedOrigin = parsedUrl.origin;
        } catch {
          redactedOrigin = '[invalid-url]';
        }

        this.logger.error(
          `webhook notification failed with status ${response.status} for ${redactedOrigin}`
        );
      }
    } catch (error: unknown) {
      let redactedOrigin = 'unknown-origin';
      try {
        redactedOrigin = new URL(webhookUrl).origin;
      } catch {
        // keep the default placeholder when the URL cannot be parsed
      }

      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`webhook notification error for ${redactedOrigin}: ${message}`);
    }
  }
}
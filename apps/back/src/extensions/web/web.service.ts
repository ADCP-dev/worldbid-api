import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '@comms/mail/mail.service';
import { ContactDto } from './dto/contact.dto';

export interface ContactSubmitResult {
  success: true;
}

@Injectable()
export class WebService {
  private readonly logger = new Logger(WebService.name);

  constructor(private readonly mailService: MailService) {}

  /**
   * Handle a public contact form submission (R-CS-05/06/07).
   *
   * - Honeypot (`website`) filled → silent 201 discard, NO email (bot trap).
   * - Valid + honeypot empty → MailService.contactFormNotification (sync send).
   * - Send failure → throws → controller catch → 500 (R-CS-07).
   */
  async submit(dto: ContactDto): Promise<ContactSubmitResult> {
    // Honeypot: humans leave this hidden field empty; bots fill it.
    if (dto.website && dto.website.trim().length > 0) {
      this.logger.debug('Contact form honeypot triggered — silently discarding');
      return { success: true };
    }

    await this.mailService.contactFormNotification(
      dto.name,
      dto.email,
      dto.message,
      dto.lang,
    );

    return { success: true };
  }
}
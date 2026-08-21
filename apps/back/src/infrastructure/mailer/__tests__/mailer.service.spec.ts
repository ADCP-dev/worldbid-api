import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * T-018 — MailerService refactored to use TemplateRenderer.
 *
 * Eliminates fs.readFile + Handlebars.compile. Injects TemplateRenderer
 * for .vue template rendering. Still handles pre-rendered html (inline)
 * and attachments passthrough. Unified from address: mail.defaultName
 * <mail.defaultEmail> (D-06).
 */
describe('T-018 — MailerService.sendMail() with TemplateRenderer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should render a .vue template via TemplateRenderer and send via nodemailer', async () => {
    const sendMailSpy = vi.fn().mockResolvedValue(undefined);
    const rendererSpy = {
      render: vi.fn().mockResolvedValue({
        html: '<p>Rendered HTML</p>',
        plaintext: 'Rendered text',
      }),
    };

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: vi.fn(),
      createPlaintext: vi.fn(),
    }));

    const { MailerService } = await import('@infra/mailer/mailer.service');
    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'mail.host') return 'smtp.test.com';
        if (key === 'mail.port') return 587;
        if (key === 'mail.defaultName') return 'Foundation';
        if (key === 'mail.defaultEmail') return 'noreply@test.com';
        return undefined;
      }),
    };

    const mailerService = new MailerService(
      configService as never,
      rendererSpy as never,
    );

    // Mock the nodemailer transporter.
    (mailerService as unknown as { transporter: { sendMail: typeof sendMailSpy } }).transporter = {
      sendMail: sendMailSpy,
    };

    await mailerService.sendMail({
      to: 'user@test.com',
      subject: 'Test',
      templatePath: '/fake/activation.vue',
      context: { subject: 'Hello' },
    });

    // TemplateRenderer.render was called with the template path + config.
    expect(rendererSpy.render).toHaveBeenCalledWith('/fake/activation.vue', {
      subject: 'Hello',
    });
    // nodemailer.sendMail received the rendered html + plaintext + unified from.
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const args = sendMailSpy.mock.calls[0][0];
    expect(args.html).toBe('<p>Rendered HTML</p>');
    expect(args.text).toBe('Rendered text');
    expect(args.from).toContain('Foundation');
    expect(args.from).toContain('noreply@test.com');
  });

  it('should use pre-rendered html when templatePath is empty', async () => {
    const sendMailSpy = vi.fn().mockResolvedValue(undefined);
    const rendererSpy = {
      render: vi.fn(),
    };

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: vi.fn(),
      createPlaintext: vi.fn(),
    }));

    const { MailerService } = await import('@infra/mailer/mailer.service');
    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'mail.defaultName') return 'Foundation';
        if (key === 'mail.defaultEmail') return 'noreply@test.com';
        return undefined;
      }),
    };

    const mailerService = new MailerService(
      configService as never,
      rendererSpy as never,
    );
    (mailerService as unknown as { transporter: { sendMail: typeof sendMailSpy } }).transporter = {
      sendMail: sendMailSpy,
    };

    await mailerService.sendMail({
      to: 'user@test.com',
      subject: 'Test',
      html: '<p>Pre-rendered</p>',
      templatePath: '',
      context: {},
    });

    // TemplateRenderer NOT called when no templatePath.
    expect(rendererSpy.render).not.toHaveBeenCalled();
    // Pre-rendered html used directly.
    expect(sendMailSpy.mock.calls[0][0].html).toBe('<p>Pre-rendered</p>');
  });

  it('should pass attachments through to nodemailer', async () => {
    const sendMailSpy = vi.fn().mockResolvedValue(undefined);
    const rendererSpy = {
      render: vi.fn().mockResolvedValue({ html: '<p>hi</p>', plaintext: 'hi' }),
    };

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: vi.fn(),
      createPlaintext: vi.fn(),
    }));

    const { MailerService } = await import('@infra/mailer/mailer.service');
    const configService = {
      get: vi.fn(() => 'val'),
    };

    const mailerService = new MailerService(
      configService as never,
      rendererSpy as never,
    );
    (mailerService as unknown as { transporter: { sendMail: typeof sendMailSpy } }).transporter = {
      sendMail: sendMailSpy,
    };

    const attachments = [{ filename: 'invoice.pdf', content: Buffer.from('x') }];
    await mailerService.sendMail({
      to: 'user@test.com',
      subject: 'Test',
      templatePath: '/fake.vue',
      context: {},
      attachments,
    });

    expect(sendMailSpy.mock.calls[0][0].attachments).toEqual(attachments);
  });
});
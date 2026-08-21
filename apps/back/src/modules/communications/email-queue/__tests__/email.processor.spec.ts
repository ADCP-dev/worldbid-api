import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * T-019 — EmailProcessor refactored to use TemplateRenderer.
 *
 * Eliminates fs.readFile + Handlebars.compile. Uses EmailDiscoveryService
 * to resolve templateName to a path, then TemplateRenderer.render().
 * Job data shape changes: { templateName, config } instead of
 * { templatePath, context }.
 */
describe('T-019 — EmailProcessor.process() with TemplateRenderer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should render via TemplateRenderer when templateName is provided', async () => {
    const renderSpy = vi.fn().mockResolvedValue({
      html: '<p>Rendered</p>',
      plaintext: 'Rendered text',
    });
    const resolveByNameSpy = vi.fn().mockResolvedValue('/abs/path/activation.vue');
    const sendMailSpy = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: vi.fn(),
      createPlaintext: vi.fn(),
    }));

    const { EmailProcessor } = await import(
      '@comms/email-queue/email.processor'
    );
    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'mail.defaultName') return 'Foundation';
        if (key === 'mail.defaultEmail') return 'noreply@test.com';
        return undefined;
      }),
    };
    const errorTrackerService = {
      logError: vi.fn().mockResolvedValue(undefined),
    };

    const processor = new EmailProcessor(
      { sendMail: vi.fn() } as never,
      configService as never,
      errorTrackerService as never,
      { render: renderSpy } as never,
      { resolveByName: resolveByNameSpy } as never,
    );

    // Mock the nodemailer transporter.
    (processor as unknown as { transporter: { sendMail: typeof sendMailSpy } }).transporter = {
      sendMail: sendMailSpy,
    };

    const job = {
      id: 'job-1',
      name: 'send-email',
      data: {
        to: 'user@test.com',
        subject: 'Test',
        templateName: 'activation',
        config: { subject: 'Hello' },
        attachments: [],
      },
      attemptsMade: 0,
    };

    await processor.process(job as never);

    // EmailDiscoveryService resolved the template name.
    expect(resolveByNameSpy).toHaveBeenCalledWith('activation');
    // TemplateRenderer.render called with resolved path + config.
    expect(renderSpy).toHaveBeenCalledWith('/abs/path/activation.vue', {
      subject: 'Hello',
    });
    // nodemailer.sendMail received rendered html + plaintext.
    expect(sendMailSpy).toHaveBeenCalledTimes(1);
    const args = sendMailSpy.mock.calls[0][0];
    expect(args.html).toBe('<p>Rendered</p>');
    expect(args.text).toBe('Rendered text');
  });

  it('should use pre-rendered html when no templateName is provided', async () => {
    const sendMailSpy = vi.fn().mockResolvedValue(undefined);
    const renderSpy = vi.fn();
    const resolveByNameSpy = vi.fn();

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: vi.fn(),
      createPlaintext: vi.fn(),
    }));

    const { EmailProcessor } = await import(
      '@comms/email-queue/email.processor'
    );
    const configService = { get: vi.fn(() => 'val') };
    const errorTrackerService = { logError: vi.fn() };

    const processor = new EmailProcessor(
      { sendMail: vi.fn() } as never,
      configService as never,
      errorTrackerService as never,
      { render: renderSpy } as never,
      { resolveByName: resolveByNameSpy } as never,
    );
    (processor as unknown as { transporter: { sendMail: typeof sendMailSpy } }).transporter = {
      sendMail: sendMailSpy,
    };

    const job = {
      id: 'job-2',
      name: 'send-email',
      data: {
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Pre-rendered</p>',
        attachments: [],
      },
      attemptsMade: 0,
    };

    await processor.process(job as never);

    // TemplateRenderer NOT called.
    expect(renderSpy).not.toHaveBeenCalled();
    expect(sendMailSpy.mock.calls[0][0].html).toBe('<p>Pre-rendered</p>');
  });

  it('should pass attachments through to nodemailer', async () => {
    const sendMailSpy = vi.fn().mockResolvedValue(undefined);
    const renderSpy = vi.fn().mockResolvedValue({ html: '<p>hi</p>', plaintext: 'hi' });
    const resolveByNameSpy = vi.fn().mockResolvedValue('/fake.vue');

    vi.doMock('@maizzle/framework', () => ({
      createRenderer: vi.fn(),
      createPlaintext: vi.fn(),
    }));

    const { EmailProcessor } = await import(
      '@comms/email-queue/email.processor'
    );
    const configService = { get: vi.fn(() => 'val') };
    const errorTrackerService = { logError: vi.fn() };

    const processor = new EmailProcessor(
      { sendMail: vi.fn() } as never,
      configService as never,
      errorTrackerService as never,
      { render: renderSpy } as never,
      { resolveByName: resolveByNameSpy } as never,
    );
    (processor as unknown as { transporter: { sendMail: typeof sendMailSpy } }).transporter = {
      sendMail: sendMailSpy,
    };

    const attachments = [{ filename: 'doc.pdf', content: Buffer.from('x') }];
    const job = {
      id: 'job-3',
      name: 'send-email',
      data: {
        to: 'user@test.com',
        subject: 'Test',
        templateName: 'activation',
        config: {},
        attachments,
      },
      attemptsMade: 0,
    };

    await processor.process(job as never);

    expect(sendMailSpy.mock.calls[0][0].attachments).toEqual(attachments);
  });
});
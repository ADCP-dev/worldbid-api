import path from 'node:path';
import { ConfigService } from '@nestjs/config';
import type { AllConfigType } from '@src/config/config.type';

let configService: ConfigService<AllConfigType>;

/** Inicializa el helper con ConfigService (llamado una vez en MailModule) */
export function initMailTemplatePath(cs: ConfigService<AllConfigType>): void {
  configService = cs;
}

function getWorkingDirectory(): string {
  if (!configService) {
    throw new Error(
      'Mail template path helper not initialized. Call initMailTemplatePath() in MailModule.',
    );
  }
  return configService.getOrThrow('app.workingDirectory', { infer: true });
}

/**
 * Resuelve la ruta absoluta a un template de email compilado (.hbs).
 * workingDirectory se resuelve internamente via ConfigService.
 *
 * @param segments - Partes del path después de build/ (ej: "activation.hbs")
 * @returns Ruta absoluta al template compilado
 */
export function getMailTemplatePath(...segments: string[]): string {
  return path.join(
    getWorkingDirectory(),
    'src',
    'modules',
    'communications',
    'mail',
    'mail-templates',
    'build',
    ...segments,
  );
}

/**
 * Helper para templates fuente Maizzle (.hbs).
 * Misma API, apunta a emails/ en vez de build/.
 */
export function getMailSourcePath(...segments: string[]): string {
  return path.join(
    getWorkingDirectory(),
    'src',
    'modules',
    'communications',
    'mail',
    'mail-templates',
    'emails',
    ...segments,
  );
}

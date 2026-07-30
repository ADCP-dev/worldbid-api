/**
 * Service Registry — maps string names to NestJS DI tokens.
 *
 * Hooks access Foundation services via ctx.getService('MailerService').
 * This registry maps the string name to the actual class token
 * that NestJS uses for dependency injection.
 *
 * The registry is populated at module registration time with the
 * actual class references, then HookContext uses ModuleRef to resolve them.
 */

// Service tokens are registered as a map of string → class.
// We use `any` here because the actual class imports would create
// circular dependencies (spec-engine should not import from all modules).
// The resolution happens via ModuleRef at runtime.

export type ServiceTokenMap = Record<string, symbol | string>;

/**
 * Known service names that hooks can request via ctx.getService().
 *
 * The string keys are the stable API that hooks use.
 * The values are NestJS DI tokens (class names as strings, resolved via ModuleRef).
 *
 * ModuleRef.get() can resolve by class reference OR by string token.
 * Since we can't import the actual classes here (circular deps),
 * we use the class name as a string and resolve via ModuleRef.
 *
 * Actually, ModuleRef.get() with a string token only works if the provider
 * was registered with that string. For class-based providers, we need
 * the actual class reference.
 *
 * Solution: The SpecEngineModule.register() receives a ModuleRef and
 * resolves services by importing the actual classes at that point
 * (where circular deps don't matter because it's at the module level,
 * not at the spec-engine core level).
 */

// We define the known names here. The actual resolution is done in
// hook-context.ts via ModuleRef, where the class imports are safe.
export const KNOWN_SERVICES = [
  'MailerService',
  'QueuedMailerService',
  'EmailService',
  'FilesService',
  'FilesS3Service',
  'FilesS3PresignedService',
  'FilesLocalService',
  'ErrorTrackerService',
  'ConfigService',
] as const;

export type KnownServiceName = (typeof KNOWN_SERVICES)[number];

/**
 * Check if a service name is known
 */
export function isKnownService(name: string): name is KnownServiceName {
  return (KNOWN_SERVICES as readonly string[]).includes(name);
}
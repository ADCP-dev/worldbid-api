import type { ZodSchema } from 'zod';
import type { Ref } from 'vue';

/**
 * Generic form validation utility using Zod.
 * @param schema - The Zod schema to validate against
 * @param form - The form state object
 * @param errors - A Vue ref object for errors (Record<string, string>)
 * @returns boolean - true if valid, false otherwise
 */
export function validateForm<T>(
  schema: ZodSchema<T>,
  form: T,
  errors: Ref<Record<string, string>>,
): boolean {
  const result = schema.safeParse(form);
  if (!result.success) {
    errors.value = {};
    result.error.issues.forEach((issue) => {
      const key = issue.path[0];
      if (typeof key === 'string' || typeof key === 'number') {
        errors.value[key] = issue.message;
      }
    });
    return false;
  }
  errors.value = {};
  return true;
}

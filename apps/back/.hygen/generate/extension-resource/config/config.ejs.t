---
to: src/extensions/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>/config/<%= h.inflection.transform(name, ['pluralize', 'underscore', 'dasherize']) %>.config.ts
---
import { registerAs } from '@nestjs/config';

// Add your extension-specific environment variables here
// class EnvironmentVariablesValidator {
//   @IsString()
//   @IsOptional()
//   MY_EXTENSION_VAR: string;
// }

export default registerAs('<%= h.inflection.camelize(h.inflection.pluralize(name), true) %>', () => {
  // validateConfig(process.env, EnvironmentVariablesValidator);

  return {
    // myVar: process.env.MY_EXTENSION_VAR || 'default',
  };
});

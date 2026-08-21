import tsEslintPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ),
  {
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
    },
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'module',
      parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error'],
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      // Use the NestJS Logger service for any persistent logging. console.log
      // shows up in stdout where no one will ever read it. console.warn and
      // console.error are still permitted as a quick escape hatch when the
      // Logger is not available (e.g. CLI scripts that are not part of the
      // NestJS lifecycle).
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.object.name=configService][callee.property.name=/^(get|getOrThrow)$/]:not(:has([arguments.1] Property[key.name=infer][value.value=true])), CallExpression[callee.object.property.name=configService][callee.property.name=/^(get|getOrThrow)$/]:not(:has([arguments.1] Property[key.name=infer][value.value=true]))',
          message:
            'Add "{ infer: true }" to configService.get() for correct typechecking. Example: configService.get("database.port", { infer: true })',
        },
        {
          selector:
            'CallExpression[callee.name=it][arguments.0.value!=/^should/]',
          message: '"it" should start with "should"',
        },
        {
          selector:
            "ImportDeclaration[source.value='handlebars']",
          message:
            'Handlebars is eliminated. Use TemplateRenderer (@comms/mail/services/template-renderer.service) for email rendering.',
        },
        {
          selector:
            "ImportDeclaration[source.value='fs/promises'] ImportSpecifier[local.name='readFile']",
          message:
            'fs.readFile is eliminated from email paths. Use TemplateRenderer for template rendering.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'handlebars',
              message:
                'Handlebars is eliminated. Use TemplateRenderer (@comms/mail/services/template-renderer.service) for email rendering.',
            },
          ],
          patterns: [
            {
              group: ['*.hbs', '**/*.hbs'],
              message:
                'Handlebars (.hbs) templates are eliminated. Use .vue templates via TemplateRenderer.',
            },
          ],
        },
      ],
    },
  },
];

/**
 * ErrorLogEntity — ActionableError columns (PRD 01)
 *
 * Verifies the entity declares the 11 new nullable columns + 3 indexes
 * that back the ActionableError enrichment. All columns are nullable so
 * existing rows survive the migration unchanged.
 *
 * Vitest runs under esbuild, which does NOT emit `design:type` metadata,
 * so TypeORM's @Column decorators do not register into the global
 * MetadataArgsStorage at test time. We therefore assert against the
 * entity source file (which is the single source of truth for the DB
 * schema) plus the property type declarations. This catches missing
 * columns, missing nullable, and missing indexes deterministically.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ErrorLogEntity } from '@src/modules/error-tracker/entities/error-log.entity';

const entitySource = readFileSync(
  resolve(
    __dirname,
    '..',
    'entities',
    'error-log.entity.ts',
  ),
  'utf-8',
);

const newColumns: Array<{
  name: string;
  type: string;
  indexed?: boolean;
}> = [
  { name: 'category', type: 'varchar', indexed: true },
  { name: 'severity', type: 'varchar' },
  { name: 'extension', type: 'varchar', indexed: true },
  { name: 'resource', type: 'varchar' },
  { name: 'specFile', type: 'varchar' },
  { name: 'operation', type: 'varchar' },
  { name: 'handlerFile', type: 'varchar' },
  { name: 'failurePoint', type: 'jsonb' },
  { name: 'suggestedFix', type: 'jsonb' },
  { name: 'relatedSpec', type: 'jsonb' },
  { name: 'requestId', type: 'varchar', indexed: true },
  { name: 'userId', type: 'int' },
];

describe('ErrorLogEntity — ActionableError columns', () => {
  for (const col of newColumns) {
    describe(`column ${col.name}`, () => {
      it(`is declared with @Column type '${col.type}' and nullable: true`, () => {
        // Match a @Column({ ... type: 'X' ... nullable: true ... }) block
        // followed by the property declaration. We look for the property
        // name as a class field to avoid matching substrings.
        const colBlockRegex = new RegExp(
          `@Column\\(\\s*\\{[^}]*type:\\s*['"]${col.type}['"][^}]*nullable:\\s*true[^}]*\\}\\s*\\)\\s*@?\\s*(?:Index\\(\\s*\\)\\s*)?${col.name}:`,
        );
        expect(colBlockRegex.test(entitySource)).toBe(true);
      });

      if (col.indexed) {
        it(`has @Index()`, () => {
          // @Index() appears on the line immediately above the @Column
          // that decorates this property. Match @Index() followed (across
          // newlines) by @Column(...) and then the property declaration.
          const indexRegex = new RegExp(
            `@Index\\(\\s*\\)[\\s\\S]*?@Column\\([^)]*\\)[\\s\\S]*?${col.name}:`,
          );
          expect(indexRegex.test(entitySource)).toBe(true);
        });
      }
    });
  }

  it('preserves the pre-existing columns', () => {
    for (const name of [
      'id',
      'hash',
      'message',
      'source',
      'stack',
      'metadata',
      'occurrences',
      'resolved',
      'resolvedAt',
      'firstOccurredAt',
      'lastOccurredAt',
    ]) {
      const propRegex = new RegExp(`^\\s*${name}:`, 'm');
      expect(propRegex.test(entitySource)).toBe(true);
    }
  });

  it('ErrorLogEntity class is exported', () => {
    expect(ErrorLogEntity).toBeDefined();
    expect(typeof ErrorLogEntity).toBe('function');
  });
});
/**
 * T9: Integration smoke test for pgvector (PRD 06).
 *
 * End-to-end: spec YAML with vector field → EntityFactory + MigrationGenerator
 * verify the generated SQL contains CREATE EXTENSION + vector(N) + HNSW index.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EntityFactory } from '@src/core/spec-engine/entity-factory';
import { MigrationGenerator } from '@src/core/spec-engine/migration-generator';
import { SpecValidator } from '@src/core/spec-engine/spec-validator';
import { SpecLoader } from '@src/core/spec-engine/spec-loader';

const VECTOR_SPEC_YAML = `name: vector-ext
version: '1.0.0'
resources:
  - name: kb-article
    table: ext_vector_kb_article
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: text
        required: true
      - name: embedding
        type: vector
        dimensions: 1536
        index: true
        indexType: hnsw
        indexParams:
          m: 16
          efConstruction: 64
        autoEmbed:
          source: content
          model: text-embedding-3-small
          provider: openai
`;

describe('pgvector integration smoke test (PRD 06)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pgvector-int-'));
    extensionsDir = path.join(tmpDir, 'extensions', 'vector-ext');
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(extensionsDir, { recursive: true });
    fs.mkdirSync(migrationsDir, { recursive: true });
    fs.writeFileSync(
      path.join(extensionsDir, 'vector-ext.spec.yaml'),
      VECTOR_SPEC_YAML,
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should validate the vector spec without errors', () => {
    const loadedSpecs = SpecLoader.load(path.join(tmpDir, 'extensions'));
    const result = SpecValidator.validateAll(loadedSpecs);
    const errors = result.errors.filter((e) => e.field === 'embedding');
    expect(errors).toHaveLength(0);
  });

  it('should generate EntitySchema with vector column + transformer', () => {
    const loadedSpecs = SpecLoader.load(path.join(tmpDir, 'extensions'));
    const spec = loadedSpecs[0].spec.resources[0];

    const result = EntityFactory.create(spec);
    const columns = (result.mainSchema.options as any).columns;

    expect(columns.embedding).toBeDefined();
    expect(columns.embedding.type).toBe('vector');
    expect(columns.embedding.transformer).toBeDefined();
    expect(columns.embedding.transformer.to).toBeInstanceOf(Function);
    expect(columns.embedding.transformer.from).toBeInstanceOf(Function);
  });

  it('should generate migration with CREATE EXTENSION + vector column + HNSW index', async () => {
    const result = await MigrationGenerator.generate(
      'vector-ext',
      path.join(tmpDir, 'extensions'),
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');

    // CREATE EXTENSION
    expect(allUp).toContain('CREATE EXTENSION IF NOT EXISTS vector');

    // vector(1536) column
    expect(allUp).toContain('vector(1536)');

    // HNSW index with cosine ops
    expect(allUp).toContain('USING hnsw');
    expect(allUp).toContain('vector_cosine_ops');
    expect(allUp).toContain('m = 16');
    expect(allUp).toContain('ef_construction = 64');

    // Index name follows convention
    expect(allUp).toContain('idx_ext_vector_kb_article_embedding_vector');
  });

  it('should generate a valid TypeORM migration file', async () => {
    const result = await MigrationGenerator.generate(
      'vector-ext',
      path.join(tmpDir, 'extensions'),
      migrationsDir,
    );

    expect(result.migrationFileName).not.toBe('');
    const filePath = path.join(migrationsDir, result.migrationFileName);
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf-8');

    // File contains TypeORM migration class
    expect(content).toContain('MigrationInterface');
    expect(content).toContain(result.migrationClassName);

    // File contains CREATE EXTENSION
    expect(content).toContain('CREATE EXTENSION IF NOT EXISTS vector');

    // File contains vector column
    expect(content).toContain('vector(1536)');
  });

  it('should round-trip transformer: array → string → array', () => {
    const loadedSpecs = SpecLoader.load(path.join(tmpDir, 'extensions'));
    const spec = loadedSpecs[0].spec.resources[0];

    const result = EntityFactory.create(spec);
    const transformer = (result.mainSchema.options as any).columns.embedding
      .transformer;

    const original = [0.1, 0.2, 0.3, 0.4];
    const toDb = transformer.to(original);
    expect(toDb).toBe('[0.1,0.2,0.3,0.4]');

    const fromDb = transformer.from(toDb);
    expect(fromDb).toHaveLength(4);
    expect(fromDb[0]).toBeCloseTo(0.1);
    expect(fromDb[3]).toBeCloseTo(0.4);
  });
});

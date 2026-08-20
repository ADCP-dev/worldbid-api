/**
 * TDD tests for MigrationGenerator vector support (PRD 06).
 *
 * REQ-04: CREATE EXTENSION IF NOT EXISTS vector when vector fields exist
 * REQ-05: vector(N) column DDL
 * REQ-06: HNSW / IVFFlat index generation
 * REQ-12: backward compatibility (no vector = no extension, no index)
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MigrationGenerator } from '@src/core/spec-engine/migration-generator';

function writeVectorExtension(
  extensionsDir: string,
  yaml: string,
  name = 'vec-demo',
): void {
  const extDir = path.join(extensionsDir, name);
  fs.mkdirSync(extDir, { recursive: true });
  fs.writeFileSync(path.join(extDir, `${name}.spec.yaml`), yaml);
}

const VECTOR_SPEC_YAML = `name: vec-demo
version: '1.0.0'
resources:
  - name: kb-article
    table: ext_vec_demo_kb_article
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: text
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

const VECTOR_SPEC_IVFFLAT_YAML = `name: vec-demo
version: '1.0.0'
resources:
  - name: kb-article
    table: ext_vec_demo_kb_article
    fields:
      - name: title
        type: string
      - name: embedding
        type: vector
        dimensions: 768
        index: true
        indexType: ivfflat
        indexParams:
          lists: 100
`;

const NO_VECTOR_SPEC_YAML = `name: plain-demo
version: '1.0.0'
resources:
  - name: article
    table: ext_plain_demo_article
    fields:
      - name: title
        type: string
`;

describe('MigrationGenerator — CREATE EXTENSION (PRD 06 — REQ-04)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-vec-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should emit CREATE EXTENSION IF NOT EXISTS vector when vector fields exist', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('CREATE EXTENSION IF NOT EXISTS vector');
  });

  it('should emit CREATE EXTENSION as the FIRST statement', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    expect(result.statements[0].up).toContain(
      'CREATE EXTENSION IF NOT EXISTS vector',
    );
  });

  it('should NOT emit CREATE EXTENSION when no vector fields exist', async () => {
    writeVectorExtension(extensionsDir, NO_VECTOR_SPEC_YAML, 'plain-demo');
    const result = await MigrationGenerator.generate(
      'plain-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).not.toContain('CREATE EXTENSION');
    expect(allUp).not.toContain('vector');
  });

  it('should emit CREATE EXTENSION only once even with multiple vector fields', async () => {
    const multiVectorYaml = `name: multi-vec
version: '1.0.0'
resources:
  - name: article
    table: ext_multi_vec_article
    fields:
      - name: title
        type: string
      - name: embed1
        type: vector
        dimensions: 384
      - name: embed2
        type: vector
        dimensions: 768
`;
    writeVectorExtension(extensionsDir, multiVectorYaml, 'multi-vec');
    const result = await MigrationGenerator.generate(
      'multi-vec',
      extensionsDir,
      migrationsDir,
    );

    const extCount = result.statements.filter((s) =>
      s.up.includes('CREATE EXTENSION IF NOT EXISTS vector'),
    ).length;
    expect(extCount).toBe(1);
  });
});

describe('MigrationGenerator — vector column DDL (PRD 06 — REQ-05)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-vec-ddl-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate vector(1536) column type in CREATE TABLE', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('vector(1536)');
  });

  it('should generate vector(768) for different dimensions', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_IVFFLAT_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('vector(768)');
  });

  it('should default vector column to nullable', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const createTable = result.statements.find((s) =>
      s.up.includes('CREATE TABLE'),
    );
    expect(createTable).toBeDefined();
    // vector column should NOT have NOT NULL (nullable by default)
    expect(createTable!.up).not.toMatch(/"embedding" vector\(1536\) NOT NULL/);
  });
});

describe('MigrationGenerator — HNSW index (PRD 06 — REQ-06)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-hnsw-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create HNSW index with vector_cosine_ops', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('USING hnsw');
    expect(allUp).toContain('vector_cosine_ops');
  });

  it('should include HNSW params m and ef_construction', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('m = 16');
    expect(allUp).toContain('ef_construction = 64');
  });

  it('should use default HNSW params when indexParams absent', async () => {
    const yaml = `name: vec-demo
version: '1.0.0'
resources:
  - name: kb-article
    table: ext_vec_demo_kb_article
    fields:
      - name: embedding
        type: vector
        dimensions: 1536
        index: true
`;
    writeVectorExtension(extensionsDir, yaml);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('USING hnsw');
    expect(allUp).toContain('m = 16');
    expect(allUp).toContain('ef_construction = 64');
  });

  it('should NOT create vector index when index is false/absent', async () => {
    const yaml = `name: vec-demo
version: '1.0.0'
resources:
  - name: kb-article
    table: ext_vec_demo_kb_article
    fields:
      - name: embedding
        type: vector
        dimensions: 1536
`;
    writeVectorExtension(extensionsDir, yaml);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).not.toContain('USING hnsw');
    expect(allUp).not.toContain('USING ivfflat');
  });
});

describe('MigrationGenerator — IVFFlat index (PRD 06 — REQ-06)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-ivf-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create IVFFlat index with lists param', async () => {
    writeVectorExtension(extensionsDir, VECTOR_SPEC_IVFFLAT_YAML);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('USING ivfflat');
    expect(allUp).toContain('lists = 100');
  });

  it('should use default lists=100 when indexParams absent for ivfflat', async () => {
    const yaml = `name: vec-demo
version: '1.0.0'
resources:
  - name: kb-article
    table: ext_vec_demo_kb_article
    fields:
      - name: embedding
        type: vector
        dimensions: 1536
        index: true
        indexType: ivfflat
`;
    writeVectorExtension(extensionsDir, yaml);
    const result = await MigrationGenerator.generate(
      'vec-demo',
      extensionsDir,
      migrationsDir,
    );

    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('USING ivfflat');
    expect(allUp).toContain('lists = 100');
  });
});

describe('MigrationGenerator — backward compatibility (PRD 06 — REQ-12)', () => {
  let tmpDir: string;
  let extensionsDir: string;
  let migrationsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mg-bc-'));
    extensionsDir = path.join(tmpDir, 'extensions');
    migrationsDir = path.join(tmpDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should generate standard migration for non-vector specs', async () => {
    writeVectorExtension(extensionsDir, NO_VECTOR_SPEC_YAML, 'plain-demo');
    const result = await MigrationGenerator.generate(
      'plain-demo',
      extensionsDir,
      migrationsDir,
    );

    expect(result.createdTables).toContain('ext_plain_demo_article');
    const allUp = result.statements.map((s) => s.up).join('\n');
    expect(allUp).toContain('CREATE TABLE');
    expect(allUp).toContain('character varying(255)');
    expect(allUp).not.toContain('vector');
  });
});
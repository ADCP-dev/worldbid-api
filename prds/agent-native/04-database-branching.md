---
doc: agent-native/04-database-branching
title: "Database Branching para Agentes"
status: draft
created: 2026-08-19
priority: P1
---

# PRD 04 — Database Branching para Agentes

## Objetivo

Permitir que un agente de coding cree un branch aislado de la base de datos para testear cambios de schema (migrations, seeds, datos) sin riesgo de tocar la DB principal. Si el cambio falla, se descarta el branch. Si pasa, se hace merge.

## Problema actual

Cuando un agente quiere añadir una extensión o modificar schema:

1. Genera una migration
2. La corre contra la DB de desarrollo
3. Si falla, tiene que revertir manualmente
4. Si corrompe datos, tiene que recrear la DB

No hay forma de testear migrations aisladas. Un agente que rompe la DB de desarrollo bloquea a todo el que la usa.

## Diseño

### Concepto: Schema-level branching

En lugar de levantar un container Postgres nuevo por branch (lento, caro), se usa **schemas de Postgres** dentro de la misma instancia:

```
Postgres instance (única)
├── public              ← DB principal (producción/desarrollo)
├── branch_agent_001    ← Branch efímero para agente
├── branch_agent_002    ← Branch efímero para otro agente
└── branch_test_xxx     ← Branch efímero para tests
```

Cada branch es un schema Postgres completo con su propia copia de todas las tablas. El agente opera contra su schema aislado.

### Consideración: pg_dump en Docker

El backend corre en un container Docker donde `pg_dump` y `psql` no están instalados (son tools de Postgres client, no del server). Hay dos estrategias:

**Estrategia A (recomendada): SQL queries con information_schema**

No usar `pg_dump`. En su lugar, usar queries SQL contra `information_schema` y `pg_constraint` para clonar la estructura. La implementación detallada está en la sección `copySchemaStructure` más abajo.

**Estrategia B: pg_dump desde el host**

Fallback opcional si el host tiene `pg_dump` instalado:

```bash
pg_dump --schema-only --schema=public "postgresql://user:pass@localhost:5432/db" | \
  sed 's/public/branch_agent_001/g' | \
  psql "postgresql://user:pass@localhost:5432/db"
```

Se implementa la estrategia A como principal (sin dependencias externas) y la B como fallback opcional.

### Ciclo de vida

```
1. Crear branch
   CREATE SCHEMA branch_agent_001
   copySchemaStructure(public, branch_agent_001)  ← information_schema queries
   copySchemaData(public, branch_agent_001)       ← topological sort + INSERT SELECT
   INSERT INTO public._db_branches(...)            ← trackear branch

2. Aplicar migration en branch
   bootSpecEngine({ branch })                      ← DataSource con search_path = branch schema
   runPending migrations contra branch_agent_001
   Test: requests contra API con search_path = branch_agent_001

3a. Merge (si pasa)
   Re-aplicar migrations originales contra public
   Verificar count de migrations
   DROP SCHEMA branch_agent_001 CASCADE
   UPDATE public._db_branches SET status='merged'

3b. Descartar (si falla)
   DROP SCHEMA branch_agent_001 CASCADE
   UPDATE public._db_branches SET status='discarded'
   -- DB principal intacta, sin cambios
```

### API: BranchManager

```typescript
// core/spec-engine/db-branch-manager.ts

export interface DbBranch {
  name: string;                // "branch_agent_001"
  schema: string;              // nombre del schema Postgres
  createdAt: string;
  createdBy: string;           // agent ID o "manual"
  status: 'active' | 'merging' | 'merged' | 'discarded' | 'failed';
  parentSchema: string;        // "public"
  copyData: boolean;           // si se copiaron datos del padre
}

export class DbBranchManager {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async createBranch(options: {
    name?: string;
    copyData?: boolean;
    parentSchema?: string;
  }): Promise<DbBranch> {
    const branchName = options.name || `branch_${randomUUID().slice(0, 8)}`;
    // Evitar doble prefijo branch_ si el name ya lo tiene
    const schema = branchName.startsWith('branch_') ? branchName : `branch_${branchName}`;
    const parent = options.parentSchema || 'public';

    // 1. Crear schema
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    // 2. Copiar estructura (tablas, indexes, constraints, sequences)
    await this.copySchemaStructure(parent, schema);

    // 3. Copiar datos si se solicita
    if (options.copyData !== false) {
      await this.copySchemaData(parent, schema);
    }

    // 4. Registrar branch en public._db_branches (importante: schema explícito)
    await this.dataSource.query(`
      INSERT INTO public._db_branches (name, schema, parent_schema, status, copy_data, created_by)
      VALUES ($1, $2, $3, 'active', $4, $5)
    `, [branchName, schema, parent, options.copyData !== false, process.env.AGENT_ID || 'manual']);

    return {
      name: branchName,
      schema,
      createdAt: new Date().toISOString(),
      createdBy: process.env.AGENT_ID || 'manual',
      status: 'active',
      parentSchema: parent,
      copyData: options.copyData !== false,
    };
  }

  async runInBranch<T>(
    branch: DbBranch,
    fn: (dataSource: DataSource) => Promise<T>,
  ): Promise<T> {
    // Crear DataSource temporal con search_path = branch.schema
    const branchDataSource = new DataSource({
      ...this.dataSource.options,
      schema: branch.schema,
    });
    await branchDataSource.initialize();
    try {
      return await fn(branchDataSource);
    } finally {
      await branchDataSource.destroy();
    }
  }

  async mergeBranch(branch: DbBranch): Promise<void> {
    // El merge NO copia datos del branch a public.
    // El branch se usa para testear migrations. El merge re-aplica
    // las mismas migrations contra public.

    // 1. Identificar qué migrations se aplicaron en el branch pero no en public
    const branchMigrations = await this.dataSource.query(`
      SELECT * FROM "${branch.schema}".typeorm_migrations
      WHERE timestamp NOT IN (
        SELECT timestamp FROM public.typeorm_migrations
      )
      ORDER BY timestamp
    `);

    // 2. Snapshot del count actual en public antes de aplicar
    const beforeCount = await this.dataSource.query(`
      SELECT count(*)::int AS count FROM public.typeorm_migrations
    `);

    // 3. Para cada migration nueva, re-aplicarla contra public
    for (const migration of branchMigrations) {
      const migrationFile = path.join(
        this.configService.get('MIGRATIONS_DIR') || 'apps/back/src/migrations',
        `${migration.timestamp}-${migration.name}.ts`
      );
      if (!existsSync(migrationFile)) {
        throw new Error(`Migration file not found: ${migrationFile}`);
      }
      await this.runMigrationAgainstPublic(migration.name);
    }

    // 4. Verificar que public tiene exactamente beforeCount + branchMigrations.length
    const afterCount = await this.dataSource.query(`
      SELECT count(*)::int AS count FROM public.typeorm_migrations
    `);
    if (afterCount[0].count !== beforeCount[0].count + branchMigrations.length) {
      throw new Error(
        `Migration count mismatch: expected ${beforeCount[0].count + branchMigrations.length}, got ${afterCount[0].count}. Manual review needed.`
      );
    }

    // 5. DROP SCHEMA branch CASCADE
    await this.dataSource.query(`DROP SCHEMA IF EXISTS "${branch.schema}" CASCADE`);

    // 6. Marcar branch como merged en public._db_branches (schema explícito)
    await this.dataSource.query(`
      UPDATE public._db_branches SET status = 'merged', merged_at = NOW()
      WHERE schema = $1
    `, [branch.schema]);
  }

  async discardBranch(branch: DbBranch): Promise<void> {
    await this.dataSource.query(`DROP SCHEMA IF EXISTS "${branch.schema}" CASCADE`);
    // Marcar branch como discarded
  }

  async listBranches(): Promise<DbBranch[]> {
    // SELECT de information_schema.schemata WHERE schema_name LIKE 'branch_%'
  }

  async cleanupStale(maxAgeHours: number = 24): Promise<void> {
    // Eliminar branches con más de maxAgeHours de inactividad
  }

  private async copySchemaStructure(from: string, to: string): Promise<void> {
    // 1. Obtener todas las tablas del schema origen
    const tables = await this.dataSource.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [from]);

    // 2. CREATE TABLE ... LIKE INCLUDING ALL copia columnas, defaults, indexes,
    //    constraints (NOT NULL, CHECK, UNIQUE), pero las FKs se copian apuntando
    //    al schema ORIGEN. Hay que eliminarlas y recrearlas apuntando al schema TO.
    for (const { table_name } of tables) {
      await this.dataSource.query(`
        CREATE TABLE "${to}"."${table_name}" (LIKE "${from}"."${table_name}" INCLUDING ALL)
      `);

      // 2a. Eliminar FKs que apuntan al schema FROM
      const fks = await this.dataSource.query(`
        SELECT con.conname, con.conrelid::regclass AS table_name
        FROM pg_constraint con
        JOIN pg_class cls ON con.conrelid = cls.oid
        JOIN pg_namespace ns ON cls.relnamespace = ns.oid
        WHERE ns.nspname = $1 AND con.contype = 'f'
      `, [to]);

      for (const fk of fks) {
        await this.dataSource.query(`
          ALTER TABLE "${to}"."${table_name}" DROP CONSTRAINT IF EXISTS "${fk.conname}"
        `);
      }

      // 2b. Recrear FKs apuntando al schema TO
      const originalFks = await this.dataSource.query(`
        SELECT con.conname, con.conrelid::regclass AS table_name,
               pg_get_constraintdef(con.oid) AS def
        FROM pg_constraint con
        JOIN pg_class cls ON con.conrelid = cls.oid
        JOIN pg_namespace ns ON cls.relnamespace = ns.oid
        WHERE ns.nspname = $1 AND con.contype = 'f' AND con.conrelid::regclass::text = $1 || '.' || $2
      `, [from, table_name]);

      for (const fk of originalFks) {
        // Reemplazar el schema FROM por TO en la definición de la FK
        const newDef = fk.def.replace(new RegExp(`"${from}"\\.`, 'g'), `"${to}".`);
        await this.dataSource.query(`
          ALTER TABLE "${to}"."${table_name}" ADD CONSTRAINT "${fk.conname}" ${newDef}
        `);
      }
    }

    // 3. Copiar sequences (necesarias para SERIAL columns)
    const sequences = await this.dataSource.query(`
      SELECT sequence_name FROM information_schema.sequences
      WHERE sequence_schema = $1
    `, [from]);
    for (const { sequence_name } of sequences) {
      await this.dataSource.query(`
        CREATE SEQUENCE IF NOT EXISTS "${to}"."${sequence_name}"
      `);
      // Sincronizar el valor actual con el del origen
      const lastVal = await this.dataSource.query(`SELECT last_value FROM "${from}"."${sequence_name}"`);
      if (lastVal[0]?.last_value) {
        await this.dataSource.query(`SELECT setval('"${to}"."${sequence_name}"', $1)`, [lastVal[0].last_value]);
      }
    }
  }

  private async copySchemaData(from: string, to: string): Promise<void> {
    // Topological sort de tablas por dependencias FK
    const tables = await this.dataSource.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `, [from]);

    // Tablas sin FKs primero, luego las que dependen de ellas
    const sorted = await this.topologicalSort(tables.map(t => t.table_name), from);

    for (const table of sorted) {
      // Usar INSERT con columnas explícitas para evitar conflictos con
      // SERIAL/IDENTITY columns — usar OVERRIDING SYSTEM VALUE para identity
      const columns = await this.dataSource.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        AND is_generated = 'NEVER'
        ORDER BY ordinal_position
      `, [from, table]);

      const colList = columns.map(c => `"${c.column_name}"`).join(', ');

      await this.dataSource.query(`
        INSERT INTO "${to}"."${table}" (${colList})
        SELECT ${colList} FROM "${from}"."${table}"
      `);
    }
  }

  private async topologicalSort(tables: string[], schema: string): Promise<string[]> {
    // Simple topological sort: tablas sin FKs primero, luego las que tienen FKs
    // a tablas ya procesadas. No es óptimo pero funciona para el caso de Foundation.
    const result: string[] = [];
    const remaining = new Set(tables);

    while (remaining.size > 0) {
      let progressed = false;
      for (const table of [...remaining]) {
        // Verificar si todas las tablas a las que hace FK ya están en result
        const deps = await this.dataSource.query(`
          SELECT ccu.table_name AS dep_table
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_schema = $1 AND tc.table_name = $2
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name != $2
        `, [schema, table]);

        const allDepsProcessed = deps.every(d => result.includes(d.dep_table));
        if (allDepsProcessed) {
          result.push(table);
          remaining.delete(table);
          progressed = true;
        }
      }
      if (!progressed) {
        // Ciclo detectado — agregar las restantes sin orden
        result.push(...remaining);
        remaining.clear();
      }
    }
    return result;
  }
}
```

### Integración con spec engine

Cuando el spec engine aplica migrations o seeds, puede hacerlo contra un branch:

```typescript
// spec-engine-boot.ts (extender)
async function bootSpecEngine(options: { branch?: DbBranch }) {
  const dataSource = options.branch
    ? await createBranchDataSource(options.branch)
    : defaultDataSource;

  const loader = new SpecLoader();
  await loader.load();

  // Aplicar migrations en el dataSource del branch
  const migrationRunner = new MigrationRunner(dataSource);
  await migrationRunner.runPending();

  // Registrar entidades contra el dataSource del branch
  // ...
}
```

### CLI para agentes

```bash
# Crear branch
pnpm db:branch:create -- --name=test-new-extension --copy-data

# Listar branches
pnpm db:branch:list

# Aplicar migration en branch
pnpm db:branch:run-migration -- --branch=test-new-extension -- AddNewExtension

# Descartar branch
pnpm db:branch:discard -- --name=test-new-extension

# Merge branch a public
pnpm db:branch:merge -- --name=test-new-extension

# Limpiar branches stale (>24h)
pnpm db:branch:cleanup
```

### Tabla de tracking

```sql
CREATE TABLE _db_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  schema VARCHAR(120) UNIQUE NOT NULL,
  parent_schema VARCHAR(120) NOT NULL DEFAULT 'public',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  copy_data BOOLEAN NOT NULL DEFAULT true,
  created_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  merged_at TIMESTAMP,
  discarded_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX idx_db_branches_status ON _db_branches(status);
```

Esta tabla vive en `public` (siempre visible) para que el BranchManager pueda trackear branches aunque esté operando en otro schema.

### Integración con MCP (PRD 02)

El MCP introspection server expone tools de branching:

```
foundation.db.create_branch    → crea branch
foundation.db.list_branches    → lista branches
foundation.db.discard_branch   → descarta branch
foundation.db.merge_branch     → merge a public
```

El agente puede:
1. Crear branch
2. Aplicar migration en branch
3. Testear contra branch
4. Si pasa → merge
5. Si falla → discard

Todo desde el MCP sin tocar la terminal.

### Limpieza automática

Un job BullMQ corre cada hora y elimina branches con más de 24h de inactividad:

```typescript
@Processor('db-branch-cleanup')
export class DbBranchCleanupProcessor {
  async process() {
    const manager = new DbBranchManager(dataSource);
    await manager.cleanupStale(24);
  }
}
```

## Implementación

### Fase 1: BranchManager core

1. Implementar `DbBranchManager` con createBranch, discardBranch, listBranches
2. Implementar `copySchemaStructure` usando `pg_dump --schema-only`
3. Implementar `copySchemaData` con topological sort de tablas por FK
4. Crear migration `_db_branches` tabla
5. CLI commands básicos

### Fase 2: runInBranch + migrations

1. Implementar `runInBranch` con DataSource temporal
2. Integrar con TypeORM migration runner para correr migrations en branch
3. Testear: crear branch, aplicar migration, verificar que public no cambió

### Fase 3: Merge + cleanup

1. Implementar `mergeBranch` (re-aplica migrations contra public)
2. Implementar job de cleanup automático
3. CLI commands de merge y cleanup

### Fase 4: MCP integration

1. Exponer tools en MCP server (PRD 02)
2. El agente puede operar branches desde su entorno

## Criterios de aceptación

1. `db:branch:create` crea un schema Postgres con la misma estructura que public
2. `db:branch:run-migration` aplica migrations solo en el branch
3. Si una migration falla en el branch, public no se ve afectada
4. `db:branch:discard` elimina el schema completamente
5. `db:branch:merge` re-aplica migrations contra public
6. El cleanup automático elimina branches con >24h
7. Múltiples agentes pueden tener branches simultáneos sin conflicto
8. `runInBranch` aísla el DataSource correctamente (queries van al schema del branch)

## Dependencias

- Sin dependencias externas nuevas
- Usa queries SQL contra `information_schema` y `pg_constraint` (nativas de Postgres)
- Usa DataSource de TypeORM (ya usado)

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| `CREATE TABLE LIKE` no copia todo (ej: permisos a nivel tabla) | Suficiente para branches efímeros de test; no para producción |
| Copy de datos grandes es lento | Solo copiar estructura por defecto; copyData opcional |
| Schemas acumulan si cleanup falla | Job + CLI manual + alerta si >10 branches activos |
| search_path conflictos | Forzar search_path explícito en cada query del branch; _db_branches siempre con schema `public.` explícito |
| Tablas con cyclic FKs | topologicalSort detecta ciclos y las procesa sin orden garantizado |
| Sequences desincronizadas tras copy | copySchemaStructure sincroniza setval al último valor del origen |
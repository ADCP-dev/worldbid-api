import { CodeIndexer } from "./indexer.js";

const args = process.argv.slice(2);
const command = args[0] as
  | "index"
  | "delete"
  | "list"
  | "export"
  | "import"
  | undefined;
const options = {
  forceReindex: args.includes("--force"),
  dryRun: args.includes("--dry-run"),
};

const currentDir = process.cwd();
const projectPath = currentDir;

if (currentDir.endsWith("mcp-engine") || currentDir.endsWith("mcp-engine\\")) {
  console.log(`
⚠️  Estás ejecutando desde la carpeta mcp-engine.
    
Ejecuta desde la RAÍZ del proyecto que quieres indexar:

  npx tsx mcp-engine/src/cli.ts index

O desde la raíz del proyecto foundation:
  cd E:\\proyectos\\MIOS\\foundation-mono\\foundation
  npx tsx mcp-engine/src/cli.ts index
`);
  process.exit(1);
}

console.log(`\n📂 Proyecto detectado: ${projectPath}\n`);

const indexer = new CodeIndexer(projectPath);

switch (command) {
  case "index":
    await indexer.index(options);
    break;

  case "delete":
    await indexer.delete();
    break;

  case "list":
    await indexer.list();
    break;

  case "export":
    const exportPath = args[1];
    await indexer.export(exportPath);
    break;

  case "import":
    const importPath = args[1];
    if (!importPath) {
      console.error("❌ Especifica la ruta del archivo: index import <ruta>");
    } else {
      await indexer.import(importPath);
    }
    break;

  default:
    console.log(`
 🔧 MCP Engine CLI

 Usage:
   npx tsx mcp-engine/src/cli.ts index          Indexar proyecto (incremental)
   npx tsx mcp-engine/src/cli.ts index --force  Re-indexar desde cero
   npx tsx mcp-engine/src/cli.ts index --dry-run Ver qué se indexaría
   npx tsx mcp-engine/src/cli.ts delete         Eliminar índice
   npx tsx mcp-engine/src/cli.ts list          Listar colecciones
   npx tsx mcp-engine/src/cli.ts export        Exportar a archivo JSON
   npx tsx mcp-engine/src/cli.ts export <path> Exportar a ruta específica
   npx tsx mcp-engine/src/cli.ts import <path> Importar desde archivo JSON

Ejemplos:
   npx tsx mcp-engine/src/cli.ts export
   npx tsx mcp-engine/src/cli.ts export ./backup-embeddings.json
   npx tsx mcp-engine/src/cli.ts import ./backup-embeddings.json
`);
    break;
}

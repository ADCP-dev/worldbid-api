import { CodeIndexer } from "./indexer.js";

const args = process.argv.slice(2);
const command = args[0] as "index" | "delete" | "list" | undefined;
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

  default:
    console.log(`
🔧 MCP Engine CLI

Usage:
  npm run mcp -- index          Indexar el proyecto actual
  npm run mcp -- index --force  Re-indexar desde cero (borra y crea)
  npm run mcp -- index --dry-run Ver qué se indexaría sin hacerlo
  npm run mcp -- delete         Eliminar índice del proyecto actual
  npm run mcp -- list           Listar todas las colecciones

El nombre de la colección se genera automáticamente desde el nombre de la carpeta.
`);
    break;
}

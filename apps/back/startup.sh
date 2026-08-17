#!/usr/bin/env bash
set -e

# Run migrations from compiled dist (no ts-node needed at runtime)
node ./node_modules/typeorm/cli.js --dataSource dist/infrastructure/database/data-source.js migration:run

# Run seeds from compiled dist
node dist/infrastructure/database/seeds/run-seed.js

# Start app
node dist/main
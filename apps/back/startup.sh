#!/usr/bin/env bash
set -e

# Run migrations from compiled dist (flat prod layout: /usr/src/app)
node ./node_modules/typeorm/cli.js --dataSource dist/infrastructure/database/data-source.js migration:run

# Run seeds (worldbid territories + IB + PLANE — idempotent)
node dist/infrastructure/database/seeds/run-seed.js

# Start app
node dist/main
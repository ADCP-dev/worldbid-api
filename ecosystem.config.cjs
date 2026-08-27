module.exports = {
  apps: [
    {
      name: 'f-back',
      script: 'pnpm',
      args: 'dev',
      cwd: '/home/dev/projects/foundation/apps/back',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'f-front',
      script: 'pnpm',
      args: 'dev',
      cwd: '/home/dev/projects/foundation/apps/front',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'f-web',
      script: 'pnpm',
      args: 'dev',
      cwd: '/home/dev/projects/foundation/apps/web',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
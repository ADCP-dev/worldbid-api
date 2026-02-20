import { registerAs } from '@nestjs/config';
import { WorkerConfig } from './worker-config.type';
import validateConfig from '@infra/utils/validate-config';
import { IsString, IsOptional } from 'class-validator';

class EnvironmentVariablesValidator {
  @IsString()
  @IsOptional()
  WORKER_HOST: string;
}

export default registerAs<WorkerConfig>('worker', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);

  const url = process.env.WORKER_HOST;

  if (!url) {
    return {
      enabled: false,
    };
  }

  let host = 'localhost';
  let port = 6379;
  let db = 0;
  let username: string | undefined;
  let password: string | undefined;

  try {
    const u = new URL(url);
    host = u.hostname || host;
    port = u.port ? parseInt(u.port, 10) : port;
    db = u.pathname ? parseInt(u.pathname.replace('/', ''), 10) : db;
    username = u.username || undefined;
    password = u.password || undefined;
  } catch {}

  return {
    host,
    port,
    db,
    username,
    password,
    enabled: true,
  };
});

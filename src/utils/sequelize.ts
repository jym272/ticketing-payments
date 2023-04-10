import { getEnvOrFail } from '@utils/env';

export const config = {
  db: {
    user: getEnvOrFail('POSTGRES_USER'),
    password: getEnvOrFail('POSTGRES_PASSWORD'),
    database: getEnvOrFail('POSTGRES_DB'),
    host: getEnvOrFail('POSTGRES_HOST'),
    port: getEnvOrFail('POSTGRES_PORT')
  }
};

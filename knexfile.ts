import dotenv from 'dotenv';
dotenv.config();

export default {
  client: 'pg',
  connection: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/scheduler_db',
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
  },
};
import knex from 'knex';
import knexConfig from '../../knexfile';

// Make sure we extract the default export configuration cleanly
const config = (knexConfig as any).default || knexConfig;

const db = knex(config);

export default db;
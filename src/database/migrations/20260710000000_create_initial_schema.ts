import type { Knex } from 'knex';
export async function up(knex: Knex): Promise<void> {
  // 1. Organizations Table
  await knex.schema.createTable('organizations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name').notNullable();
    table.timestamps(true, true);
  });

  // 2. Projects Table
  await knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('org_id').references('id').inTable('organizations').onDelete('CASCADE');
    table.string('name').notNullable();
    table.timestamps(true, true);
  });

  // 3. Queues Table
  await knex.schema.createTable('queues', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.string('name').notNullable();
    table.integer('max_concurrent_workers').defaultTo(5);
    table.boolean('is_paused').defaultTo(false);
    table.timestamps(true, true);
    table.unique(['project_id', 'name']);
  });

  // 4. Jobs Table
  await knex.schema.createTable('jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('queue_id').references('id').inTable('queues').onDelete('CASCADE');
    table.jsonb('payload').notNullable();
    table.string('status').defaultTo('QUEUED');
    table.integer('priority').defaultTo(0);
    table.string('idempotency_key').nullable();
    table.string('retry_strategy').defaultTo('EXPONENTIAL');
    table.integer('max_retries').defaultTo(3);
    table.string('cron_expression').nullable();
    table.timestamp('run_at').defaultTo(knex.fn.now());
    
    // 🔧 ADD THESE THREE MISSING COLUMNS HERE:
    table.integer('retry_count').defaultTo(0);
    table.timestamp('finished_at').nullable();
    table.text('error_message').nullable();

    table.timestamps(true, true);
  });

  // Execute a raw SQL statement to safely build the partial performance index
  await knex.raw(`
    CREATE INDEX idx_jobs_processing 
    ON jobs (status, priority DESC, run_at ASC) 
    WHERE status = 'QUEUED';
  `);

  // 5. Job Executions Table
  await knex.schema.createTable('job_executions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('job_id').references('id').inTable('jobs').onDelete('CASCADE');
    table.string('worker_id').notNullable();
    table.string('status').notNullable();
    table.text('error_log').nullable();
    table.timestamp('started_at').defaultTo(knex.fn.now());
    table.timestamp('finished_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('job_executions');
  await knex.schema.dropTableIfExists('jobs');
  await knex.schema.dropTableIfExists('queues');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('organizations');
}
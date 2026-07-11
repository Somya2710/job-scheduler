import knexModule from 'knex';

export async function up(knex: any): Promise<void> {
  return knex.schema.alterTable('jobs', (table: any) => {
    // Adds the self-referencing workflow dependency column pointer link
    table.uuid('parent_job_id')
      .nullable()
      .references('id')
      .inTable('jobs')
      .onDelete('SET NULL');
  });
}

export async function down(knex: any): Promise<void> {
  return knex.schema.alterTable('jobs', (table: any) => {
    table.dropColumn('parent_job_id');
  });
}
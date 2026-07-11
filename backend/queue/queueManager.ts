import db from '../database/db';
import { Job } from '../types';

export class QueueManager {
  static async claimNextJob(workerId: string): Promise<Job | null> {
    return db.transaction(async (trx) => {
      const now = new Date();

      const job = await trx<Job>('jobs')
        .where('status', 'QUEUED')
        .andWhere('run_at', '<=', now)
        .orderBy('priority', 'desc')
        .orderBy('run_at', 'asc')
        .limit(1)
        .forUpdate()
        .skipLocked()
        .first();

      if (!job) return null;

      await trx('jobs').where('id', job.id).update({
        status: 'RUNNING',
        updated_at: now
      });

      await trx('job_executions').insert({
        job_id: job.id,
        worker_id: workerId,
        status: 'RUNNING',
        started_at: now
      });

      return { ...job, status: 'RUNNING' };
    });
  }
}
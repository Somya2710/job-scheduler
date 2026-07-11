export type JobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'DLQ';
export type RetryStrategy = 'FIXED' | 'LINEAR' | 'EXPONENTIAL';

export interface Job {
  id: string;
  queue_id: string;
  payload: any;
  status: JobStatus;
  priority: number;
  idempotency_key: string | null;
  cron_expression: string | null;
  retry_count: number;
  max_retries: number;
  retry_strategy: RetryStrategy;
  run_at: Date;
  created_at: Date;
  updated_at: Date;
}
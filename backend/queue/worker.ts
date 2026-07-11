import db from '../database/db';

interface Job {
  id: string;
  queue_id: string;
  payload: string;
  status: 'QUEUED' | 'SCHEDULED' | 'CLAIMED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  retry_count: number;
  max_retries: number;
  retry_strategy: 'EXPONENTIAL' | 'LINEAR' | 'FIXED';
  run_at: Date;
}

export class Worker {
  private workerId: string;
  private isRunning: boolean = false;

  constructor(workerId: string) {
    this.workerId = workerId;
  }

  // ⚡ MAKE SURE THIS START METHOD IS EXACTLY HERE AND EXPOSED AS PUBLIC
  public async start() {
    this.isRunning = true;
    console.log(`🌐 Worker ${this.workerId} has started and is looking for jobs...`);

    while (this.isRunning) {
      try {
        // 1. Try to fetch and lock a job atomically
        const job = await this.claimNextJob();

        if (!job) {
          // No jobs available right now. Sleep for 1 second before checking again.
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        // 2. Execute the job lifecycle path
        await this.executeJob(job);

      } catch (error) {
        console.error(`❌ Unexpected error in worker execution loop:`, error);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  public stop() {
    this.isRunning = false;
    console.log(`🛑 Stopping Worker ${this.workerId} gracefully...`);
  }

  // Atomically poll and claim jobs using FOR UPDATE SKIP LOCKED
  private async claimNextJob(): Promise<Job | null> {
    return await db.transaction(async (trx) => {
      const job = await trx('jobs')
        .where('status', 'QUEUED')
        .andWhere('run_at', '<=', new Date())
        .andWhere(function() {
          // ⛓️ WORKFLOW DEPENDENCY RULES:
          // Claim the job if it doesn't have a parent OR if its parent is already fully COMPLETED
          this.whereNull('parent_job_id')
              .orWhereIn('parent_job_id', function() {
                this.select('id').from('jobs').where('status', 'COMPLETED');
              });
        })
        .orderBy('priority', 'desc')
        .orderBy('created_at', 'asc')
        .forUpdate()
        .skipLocked()
        .first();

      if (!job) return null;

      const [claimedJob] = await trx('jobs')
        .where('id', job.id)
        .update({
          status: 'CLAIMED',
          updated_at: new Date()
        })
        .returning('*');

      return claimedJob;
    });
  }

 private async executeJob(job: Job) {
    try {
      // 1. Transition: Claimed ➔ Running
      await db('jobs').where('id', job.id).update({ status: 'RUNNING' });
      console.log(`⚙️ Worker [${this.workerId}] is running Job ID: ${job.id}`);

      // ⏳ Hold the job in running state for 2 seconds so we can see it on the UI
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 🛡️ SAFE PROCESSING BLOCK: Safe parsing prevents automatic failure routing
      let taskPayload;
      try {
        taskPayload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      } catch (e) {
        taskPayload = job.payload; // Fallback if it's already an object or raw string
      }
      
      console.log(`✨ Processing data payload successfully:`, taskPayload);

      // 2. Transition: Running ➔ COMPLETED (Success path!)
      await db('jobs').where('id', job.id).update({
        status: 'COMPLETED',
        finished_at: new Date()
      });
      console.log(`✅ Job ${job.id} transitioned cleanly to COMPLETED.`);
      const dependents = await db('jobs').where({
        parent_job_id: job.id,
        status: 'QUEUED'
      });

      if (dependents.length > 0) {
        console.log(`🔗 Dependency Router: Unlocking ${dependents.length} downstream tasks waiting on parent ${job.id}...`);
        
        await db('jobs')
          .where({ parent_job_id: job.id, status: 'QUEUED' })
          .update({
            status: 'SCHEDULED', // Moves them into the live polling stream window
            run_at: new Date()   // Workers can pick them up instantly
          });
      }

    } catch (error: any) {
      // This will now only trigger if something catastrophically breaks
      await this.handleJobFailure(job, error);
    }
  }

  private async handleJobFailure(job: Job, error: any) {
    const nextAttempts = (job.retry_count || 0) + 1;

    if (nextAttempts >= job.max_retries) {
      console.log(`🤖 Analyzing job failure with AI for Job ID: ${job.id}...`);
      
      let aiSummary = `DLQ Max Retries Exceeded: ${error.message}`;
      
      // 📡 Call Gemini API securely via standard fetch endpoints
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [{
                    text: `You are an expert systems engineer debugging a background distributed job queue. 
                    A job with payload "${job.payload}" crashed with this runtime error: "${error.message}". 
                    Provide a concise, 1-2 sentence summary explaining exactly why it failed in plain text. Do not use markdown.`
                  }]
                }]
              })
            }
          );
          
          const data = await response.json();
          if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            aiSummary = `🤖 AI Summary: ${data.candidates[0].content.parts[0].text.trim()}`;
          }
        }
      } catch (aiErr) {
        console.error("⚠️ Failed to fetch AI failure summary:", aiErr);
      }

      // 🛑 DEAD LETTER QUEUE (DLQ) ACTION: Permanent Failure Isolation with AI summary
      await db('jobs').where('id', job.id).update({
        status: 'FAILED',
        retry_count: nextAttempts,
        error_message: aiSummary,
        finished_at: new Date()
      });
      console.error(`🚨 Job ${job.id} passed max retries. Isolated to Dead Letter Queue state.`);
    } else {
      // 🔄 RETRY ALGORITHM CONFIGURATION: Calculate Backoffs
      let delaySeconds = 10;
      
      if (job.retry_strategy === 'EXPONENTIAL') {
        delaySeconds = Math.pow(2, nextAttempts) * 5; 
      } else if (job.retry_strategy === 'LINEAR') {
        delaySeconds = nextAttempts * 15;
      }

      const backoffWindow = new Date(Date.now() + delaySeconds * 1000);

      // Transition: Running ➔ Scheduled (Waiting for backoff loop window)
      await db('jobs').where('id', job.id).update({
        status: 'SCHEDULED',
        retry_count: nextAttempts,
        run_at: backoffWindow,
        error_message: error.message
      });
      console.log(`🔄 Backoff scheduled. Job ${job.id} moving to SCHEDULED state until ${backoffWindow.toLocaleTimeString()}.`);
    }
  }
  
}

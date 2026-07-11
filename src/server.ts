import { createServer } from 'http';
import { Server } from 'socket.io';
import express from 'express';
import cors from 'cors'; 
import db from './database/db';
import rateLimit from 'express-rate-limit';

const app = express();

app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(express.json());

const authenticateApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== 'super-secret-admin-key') {
    res.status(401).json({ error: 'Unauthorized: Invalid or missing X-API-KEY header.' });
    return;
  }

  next();
};

// 1. Endpoint to initialize a test Organization, Project, and Queue setup
app.post('/api/setup', async (req, res) => {
  try {
    let org = await db('organizations').first();
    if (!org) {
      [org] = await db('organizations').insert({ name: 'Acme Corp' }).returning('*');
    }

    let project = await db('projects').where('org_id', org.id).first();
    if (!project) {
      [project] = await db('projects').insert({ org_id: org.id, name: 'Main Platform' }).returning('*');
    }

    let queue = await db('queues').where('project_id', project.id).first();
    if (!queue) {
      [queue] = await db('queues').insert({ 
        project_id: project.id, 
        name: 'default-emails',
        max_concurrent_workers: 5
      }).returning('*');
    }

    res.json({ message: '✨ Setup ready!', orgId: org.id, projectId: project.id, queueId: queue.id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const jobSubmissionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 100, // 🚀 Raised to 100 requests per minute for local performance testing
  message: { error: "Too Many Requests..." }
});

// 2. Endpoint to submit a background job to the queue (With parentJobId support!)
app.post('/api/jobs',jobSubmissionLimiter, authenticateApiKey, async (req, res) => {
  // 1. 🔧 Change "const" to "let" here:
  let { queueId, payload, priority, retryStrategy, maxRetries, idempotencyKey, delaySeconds, cronExpression, batchJobs, parentJobId } = req.body;

  try {
    // 2. 🔧 Paste this safety lookup block right here at line 58:
    if (!queueId || queueId === '8296c08b-3db0-424d-841f-5c6539aa13d1') {
      const activeQueue = await db('queues').first();
      if (activeQueue) {
        queueId = activeQueue.id;
      }
    }
    if (batchJobs && Array.isArray(batchJobs)) {
      const insertedBatch = await db.transaction(async (trx) => {
        const insertPromises = batchJobs.map(job => {
          return trx('jobs').insert({
            queue_id: queueId,
            payload: JSON.stringify(job.payload),
            status: 'QUEUED',
            priority: job.priority || 0,
            run_at: new Date()
          }).returning('*');
        });
        return Promise.all(insertPromises);
      });
      await db.raw("NOTIFY job_available, 'new_job_queued'");
      res.status(201).json({ message: `📥 Batch of ${batchJobs.length} jobs successfully queued!`, jobs: insertedBatch.flat() });
      return;
    }

    if (!queueId || !payload) {
      res.status(400).json({ error: 'Missing queueId or payload parameters.' });
      return;
    }

    let runAt = new Date();
    if (delaySeconds) {
      runAt = new Date(Date.now() + delaySeconds * 1000);
    }

    const [newJob] = await db('jobs').insert({
      queue_id: queueId,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
      status: cronExpression ? 'SCHEDULED' : 'QUEUED', 
      priority: priority || 0,
      idempotency_key: idempotencyKey || null,
      max_retries: maxRetries || 3,
      retry_strategy: retryStrategy || 'EXPONENTIAL',
      cron_expression: cronExpression || null,
      parent_job_id: parentJobId || null, // 🔗 Correctly maps our workflow chains
      run_at: runAt
    }).returning('*');

    await db.raw("NOTIFY job_available, 'new_job_queued'");

    res.status(201).json({ success: true, message: cronExpression ? '📅 Recurring scheduled job registered!' : '📥 Job successfully queued!', job: newJob, data: newJob });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Idempotency conflict. Duplicate token found.' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// 3. Clean and Unnested GET Pipeline for Dashboard Polling Metrics
app.get('/api/jobs', authenticateApiKey, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50; // Increased default limit to catch all types!
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as string;

    // 1. Build a clean base query instance for data retrieval
    let dataQuery = db('jobs');
    // 2. Build a completely separate clone query instance for counting total logs
    let countQuery = db('jobs');

    // 3. ⚡ DYNAMIC FILTER: Apply filtering rules to BOTH query contexts identically
    if (status && status !== 'ALL' && status !== 'undefined' && status !== '') {
      dataQuery = dataQuery.where('status', status);
      countQuery = countQuery.where('status', status);
    }

    // 4. Fetch the total count accurately
    const [countResult] = await countQuery.count('* as count');
    const total = parseInt(countResult.count as string) || 0;

    // 5. Fetch the actual rows matching the current viewport parameters
    const data = await dataQuery
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // 6. Return the correct payload matching what frontend store expects
    return res.json({
      data,
      total,
      limit,
      offset
    });
  } catch (error: any) {
    console.error("❌ Backend API Error:", error);
    return res.status(500).json({ error: error.message });
  }
});

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected to WebSocket stream: ${socket.id}`);
  socket.on('disconnect', () => console.log('🔌 Client disconnected'));
});

export function startApiServer() {
  const PORT = process.env.PORT || 4000;
  
  // ⚡ CRITICAL: Listen using the wrapper httpServer instead of app.listen
  httpServer.listen(PORT, () => {
    console.log(`🚀 REST & WebSocket Server running on http://localhost:${PORT}`);
  });
}
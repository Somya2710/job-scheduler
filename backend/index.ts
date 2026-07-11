import { Worker } from './queue/worker';
import { startApiServer } from './server';
import crypto from 'crypto';
import db from './database/db'; // Make sure this matches the path to your database configuration

async function main() {
  // 1. Boot up our API routing network
  startApiServer();

  // 2. Spawn our background execution engine instance
  const uniqueWorkerName = `worker-${crypto.randomUUID().slice(0, 6)}`;
  const workerInstance = new Worker(uniqueWorkerName);

  // Run an immediate check to catch anything already queued up from a previous session
  await workerInstance.start();

  // 3. ⚡ EVENT-DRIVEN REACTIVE PIPELINE
  try {
    const rawClient = await db.client.acquireRawConnection();
    await rawClient.query('LISTEN job_available');
    console.log("⚡ PostgreSQL Event Pipeline established. Listening for real-time jobs...");

    rawClient.on('notification', async (msg: any) => {
      console.log(`\n🔔 Event Received [${msg.payload}]: Processing queue immediately...`);
      
      // 1. Tell the worker instance to step through the queue immediately
      await workerInstance.start(); 

      // 2. 📣 BROADCAST LIVE: Tell the WebSocket server to emit an update event to the frontend UI!
      const { io } = require('./server'); 
      io.emit('queue_updated', { message: 'Queue updated dynamically' });
    });
  } catch (eventError) {
    console.error("⚠️ Event pipeline failed to bind, falling back entirely to worker timer logs:", eventError);
  }
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
});
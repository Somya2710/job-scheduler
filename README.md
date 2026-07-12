# 🚀 Production-Grade Distributed Job Scheduler

A resilient, end-to-end distributed task orchestration engine designed to handle high-volume asynchronous jobs. This system separates public-facing ingestion APIs from resource-heavy compute workers using a decoupled architecture, ensuring optimal user-interface responsiveness, low-latency priority queue sorting, and crash resilience.

---

## 🏗️ System Architecture & Data-Flow

The application leverages an **Event-Driven, Decoupled Micro-Architecture** to process continuous high-volume queue workloads cleanly.

* **Ingestion Gate:** Next.js dashboard dispatches structured task payloads via an authenticated REST API request to the Node.js/Express ingestion tier.
* **Persistence Queue Entry:** The server applies rate-limiting validation and persists the request details straight into a highly indexed PostgreSQL table.
* **Decoupled Processing Engine:** Independent background workers continuously fetch high-priority rows using strict transaction routines to secure operational updates safely.
* **Real-Time Push Loop:** Upon worker stage completions, the server broadcasts lightweight synchronization packets down a persistent Socket.io WebSocket stream, causing the frontend UI grid to transition state flags automatically.

---

## 🗄️ Database Schema & Indexing Design

To achieve high throughput with optimal index lookup times, the schema avoids complex multi-table join blockages by storing contextual parameters inside optimized column targets.

### Jobs Table Structure (`jobs`)
* `id` (UUID, Primary Key): Unique systemic tracking identifier.
* `queue_id` (UUID, Indexed): Maps jobs to an initialized queue target.
* `status` (VARCHAR/ENUM, Indexed): Lifecycle states (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`).
* `priority` (INTEGER, Indexed): Scheduling weight scale for execution sorting (Higher priority runs first).
* `payload` (JSONB): Dynamic execution context variables (e.g., target emails, tasks).
* `createdAt` / `updated_at` (TIMESTAMP): Automated tracking markers.

### Strategic Indexing Paradigm
* `idx_jobs_status`: Built directly on the `status` flag. This allows workers to exclusively fetch pending tasks (`QUEUED`) instantly, while enabling the frontend dashboard to run ultra-fast filters.
* `idx_jobs_priority_created`: A compound sorting index combining `priority DESC` and `createdAt ASC`. This guarantees the background thread pool fetches rows precisely in priority order with absolute consistency.

---

## 🛡️ Concurrency & Reliability Enhancements

* **Double-Processing Prevention:** Background queue workers query and allocate pending rows within a strict database transaction lock (`FOR UPDATE SKIP LOCKED` / explicit transaction status updates). This ensures an allocated job is completely invisible to other workers before execution thread allocation fires.
* **Dual-Channel Observability Safety:** The frontend uses a locked-down, single-instance WebSocket listener combined with a 2-second background polling timer loop. If the client experiences temporary network drops, the polling loop seamlessly keeps the interface updated.

---

## ⚙️ Development Environment Setup Instructions

### Prerequisites
* **Runtime:** Node.js (v18.x+) & npm (v9.x+)
* **Storage Engine:** PostgreSQL database instance

###  Database Layer Configuration
Log into your local PostgreSQL client environment and establish a new empty database:
```sql
CREATE DATABASE distributed_job_scheduler;

### BACKEND SERVER AND WORKERS ACTIVATION 
1. Navigate to the backend directory and install dependencies:

cd backend
npm install

2. Create a .env file inside the /backend folder:
PORT=4000
DATABASE_URL=postgres://username:password@localhost:5432/distributed_job_scheduler
NODE_ENV=development

3.Run database migrations to build tables:
npx knex migrate:latest

4. Compile TypeScript and start the engine:
npx tsc && node dist/src/index.js

### 3. Frontend Dashboard Deployment
1. Open a new terminal window, navigate into the frontend directory, and run the installation script:
cd frontend
npm install

2. Run the Next.js local framework development environment:
npm run dev

3. View the system tracking console dashboard at: http://localhost:3000


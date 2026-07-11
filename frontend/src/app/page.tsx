'use client';
import { io } from 'socket.io-client';
import { useState, useEffect, useRef} from 'react';
import { useJobStore } from '@/store/useJobStore';
import { Play, Layers, CheckCircle, Clock, AlertTriangle, Sliders, RefreshCw, Pause } from 'lucide-react';


export default function Dashboard() {
  const { jobs, total, offset, loading, fetchJobs, triggerSetup, isPaused, maxWorkers, updateConfig } = useJobStore();
  const [activeQueueId, setActiveQueueId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  // Local configuration inputs
  const [workersInput, setWorkersInput] = useState<number>(5);
  const latestStateRef = useRef({ statusFilter, offset, fetchJobs });

// Keep the ref mirror synchronized on every layout render pass
 // =================================================================
  // 🔌 HOOK 1: Persistent Real-Time WebSocket Connection
  // =================================================================
  useEffect(() => {
    // Run the initial data pull on page mount
    fetchJobs(statusFilter, offset);

    // Open a single, permanent pipeline stream to the backend
    const socket = io('http://localhost:4000');

    socket.on('connect', () => {
      console.log('🔌 Connected securely to real-time WebSocket pipeline!');
    });

    // Listen for live database change notifications from the worker loop
    socket.on('queue_updated', () => {
      console.log('⚡ Live broadcast received! Refreshing metrics rows...');
      const freshStore = useJobStore.getState();
      freshStore.fetchJobs(statusFilter, offset);
    });

    // Clean up channel listener when moving to a different route context
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 🚀 Empty dependency array keeps the stream open without resetting!

  // =================================================================
  // ⏱️ HOOK 2: Safe Background Polling Fallback Auto-Refresher
  // =================================================================
  useEffect(() => {
    // Sets up a clean background heartbeat ticker
    const refreshInterval = setInterval(() => {
      fetchJobs(statusFilter, offset);
    }, 2000); // 🔄 Pulls the latest database table snapshot every 2 seconds

    // Instantly kills the old timer when dependencies change to prevent memory leaks
    return () => clearInterval(refreshInterval);
  }, [statusFilter, offset, fetchJobs]);
  const [localQueueId, setLocalQueueId] = useState<string | null>(null);
  const submitTestJob = async () => {
  console.log("🚀 submitTestJob function triggered!"); 
  
  if (!localQueueId) {
    console.error("❌ Cannot push job: localQueueId is missing.");
    return;
  }

  try {
    const res = await fetch('http://localhost:4000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'super-secret-admin-key'
      },
      body: JSON.stringify({
        queueId: localQueueId,
        payload: { email: "rahul@example.com", action: "send_welcome_email" },
        priority: 10,
        retryStrategy: "LINEAR",
        maxRetries: 3
      })
    });

    if (res.ok) {
      console.log("✅ Job successfully dispatched!");
      
      // ⚡ CRITICAL: Force the dashboard to refresh the UI list immediately!
      // (Pass your existing statusFilter and pageOffset state variables if required)
      fetchJobs(statusFilter, offset); 
      
    } else {
  // Safe parsing fallback so Next.js never throws a runtime crash screen
  let errorMsg = "Unknown Error";
  try {
    const errData = await res.json();
    errorMsg = JSON.stringify(errData);
  } catch (e) {
    errorMsg = `Status code: ${res.status}`;
  }
  console.error("❌ Backend error details:", errorMsg);
}
  } catch (err) {
    console.error("❌ Network execution error:", err);
  }
};

  // Maps the aggregate status collections accurately for the top counter slots
  const getCount = (statusType: 'RUNNING' | 'COMPLETED' | 'FAILED') => {
    if (statusType === 'RUNNING') {
      return jobs.filter(j => j.status === 'RUNNING' || j.status === 'CLAIMED').length;
    }
    if (statusType === 'COMPLETED') {
      return jobs.filter(j => j.status === 'COMPLETED' || j.status === 'SUCCEEDED').length;
    }
    if (statusType === 'FAILED') {
      return jobs.filter(j => j.status === 'FAILED').length;
    }
    return 0;

  };

  // Handles custom color formatting styles dynamically for all state paths
  const getStatusBadgeStyle = (status: string) => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
      case 'SUCCEEDED':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'RUNNING':
      case 'CLAIMED':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'FAILED':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'QUEUED':
      case 'SCHEDULED':
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    }
  };
const handleSetup = async () => {
    try {
      const res = await fetch('http://localhost:4000/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'super-secret-admin-key'
        },
        body: JSON.stringify({ orgId: "demo-org" })
      });
      
      if (res.ok) {
        const data = await res.json();
        console.log("Setup data received:", data);
        
        // ⚡ CRITICAL: Extract and set the active queue ID to unlock the push button!
        // Adjust 'data.queueId' if your backend returns it inside a different property name (e.g., data.data.queueId)
        if (data && data.queueId) {
          setLocalQueueId(data.queueId);
        }
        
        alert("🚀 Distributed System Environment Context Initialized!");
      } else {
        const errData = await res.json();
        console.error("Setup endpoint failed:", errData);
      }
    } catch (err) {
      console.error("Network error triggering system context setup:", err);
    }
  };
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-8 font-sans">
      {/* Top Banner Control Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">🚀 Distributed Job Scheduler</h1>
          <p className="text-gray-400 mt-1">System Health & Live Queue Metrics Console</p>
        </div>
        <button onClick={handleSetup} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-3 rounded-lg font-medium transition shadow-md">
          <Play size={18} /> Initialize Context Setup
        </button>
      </header>

      {/* Queue Health Metrics Component */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex items-center justify-between">
          <div><p className="text-gray-400 text-sm font-medium">Total Queue Jobs</p><h3 className="text-2xl font-bold mt-1">{total}</h3></div>
          <Layers className="text-indigo-400" size={24} />
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex items-center justify-between">
          <div><p className="text-gray-400 text-sm font-medium">Running Allocations</p><h3 className="text-2xl font-bold mt-1 text-amber-400">{getCount('RUNNING')}</h3></div>
          <Clock className="text-amber-400" size={24} />
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex items-center justify-between">
          <div><p className="text-gray-400 text-sm font-medium">Succeeded Execution Logs</p><h3 className="text-2xl font-bold mt-1 text-emerald-400">{getCount('COMPLETED')}</h3></div>
          <CheckCircle className="text-emerald-400" size={24} />
        </div>
        <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl flex items-center justify-between">
          <div><p className="text-gray-400 text-sm font-medium">Dead-Letter / Failed</p><h3 className="text-2xl font-bold mt-1 text-rose-500">{getCount('FAILED')}</h3></div>
          <AlertTriangle className="text-rose-500" size={24} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Control and Configuration Column */}
        <div className="space-y-8">
          {/* Queue Configuration Component */}
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-indigo-400">
              <Sliders size={20} /> Queue Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Max Concurrent Workers ({workersInput})</label>
                <input type="range" min="1" max="20" value={workersInput} onChange={(e) => { setWorkersInput(Number(e.target.value)); updateConfig(activeQueueId, Number(e.target.value), isPaused); }} className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer mt-2" />
              </div>
              <div className="pt-2">
                <button onClick={() => updateConfig(activeQueueId, maxWorkers, !isPaused)} className={`w-full flex items-center justify-center gap-2 font-medium py-2.5 px-4 rounded-lg transition ${
                  isPaused ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                }`}>
                  <Pause size={16} /> {isPaused ? 'Resume Background Processing' : 'Pause Processing Loops'}
                </button>
              </div>
            </div>
          </div>

          {/* Active Worker Status Panel */}
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-400">
              <RefreshCw size={20} /> Worker Lifecycle Status
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-gray-950 p-3 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="font-mono text-xs">worker-core-01</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded">Polling Active</span>
              </div>
              <div className="flex justify-between items-center bg-gray-950 p-3 rounded-lg border border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="font-mono text-xs">worker-core-02</span>
                </div>
                <span className="text-xs font-bold text-emerald-400 uppercase bg-emerald-500/10 px-2 py-0.5 rounded">Polling Active</span>
              </div>
            </div>
          </div>

          {/* Inject Task Form */}
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-400">
              <Layers size={20} /> Submit Immediate Job
            </h2>
            <div className="mb-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">Target Queue UUID</label>
              <input
                type="text"
                readOnly
                value={localQueueId || ""}
                placeholder="Run Initialization setup to bind context..."
                className="..."
              />            </div>
            <button disabled={!localQueueId || submitting} onClick={submitTestJob} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 text-white font-medium py-3 rounded-lg transition shadow-md">
              {submitting ? 'Queuing Job...' : 'Push Prioritized Test Job'}
            </button>
          </div>
        </div>

        {/* Right Columns: Job Explorer & Execution Logs */}
        <div className="lg:col-span-2 w-full bg-gray-900 border border-gray-800 rounded-xl p-6 max-h-[650px] overflow-y-auto custom-scrollbar">          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold">📋 Job Explorer & Execution Logs</h2>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 focus:outline-none">
              <option value="">All Lifecycles</option>
              <option value="QUEUED">Queued</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CLAIMED">Claimed</option>
              <option value="RUNNING">Running</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-950 text-gray-400 uppercase text-xs tracking-wider">
                <tr>
                  <th className="p-4 rounded-l-lg">Job Tracking ID</th>
                  <th className="p-4">Status Flag</th>
                  <th className="p-4">Weight Priority</th>
                  <th className="p-4">Timestamp</th>
                  <th className="p-4 rounded-r-lg">Logs / Diagnostics</th> 
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                    {jobs.filter((job) => !statusFilter || statusFilter === 'ALL' || job.status === statusFilter).map((job) => (                  <tr key={job.id} className="hover:bg-gray-800/30 transition">
                    <td className="p-4 font-mono text-xs text-indigo-400">{job.id}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeStyle(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-4 font-medium">{job.priority}</td>
                    <td className="p-4 text-gray-400 text-xs">{new Date(job.created_at).toLocaleTimeString()}</td>
                    
                    {/* 🔧 Added this diagnostic text display column below */}
                    <td className="p-4 text-xs max-w-xs font-mono">
                      {job.status === 'FAILED' ? (
                        <span className="text-rose-400 block break-words" title={job.error_message || undefined}>
                          {job.error_message || 'Processing fault isolated.'}
                        </span>
                      ) : job.status === 'COMPLETED' ? (
                        <span className="text-emerald-500">✨ Completed smoothly</span>
                      ) : (
                        <span className="text-gray-500">Processing lifecycle active...</span>
                      )}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-gray-500 font-medium">No background logs matches found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
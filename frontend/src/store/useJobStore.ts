import { create } from 'zustand';

interface Job {
  id: string;
  status: string;
  priority: number;
  payload: any;
  created_at: string;
  error_message?: string | null;
}

interface JobStore {
  jobs: Job[];
  total: number;
  limit: number;
  offset: number;
  loading: boolean;
  isPaused: boolean;
  maxWorkers: number;
  fetchJobs: (status?: string, pageOffset?: number) => Promise<void>;
  triggerSetup: () => Promise<string | null>;
  updateConfig: (queueId: string, maxWorkers: number, isPaused: boolean) => Promise<void>;
}

export const useJobStore = create<JobStore>((set) => ({
  jobs: [],
  total: 0,
  limit: 10,
  offset: 0,
  loading: false,
  isPaused: false,
  maxWorkers: 5,
  fetchJobs: async (status = '', pageOffset = 0) => {
    set({ loading: true });
    try {
      // Force an absolute URL object so it breaks out of the Next.js local asset path router
      const url = new URL('http://127.0.0.1:4000/api/jobs');
      url.searchParams.set('limit', '10');
      url.searchParams.set('offset', pageOffset.toString());
        // 🔧 Update lines 40–42 to ignore the "ALL" filter value:
        if (status && status !== 'ALL') {
            url.searchParams.set('status', status);
        }

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': 'super-secret-admin-key' 
        }
      });

      if (!res.ok) {
        throw new Error(`Server responded with status: ${res.status}`);
      }

      const data = await res.json();
      set({ jobs: data.data || [], total: data.total || 0, offset: data.offset || 0, loading: false });
    } catch (err) {
      console.error('Failed to sync jobs history:', err);
      set({ loading: false });
    }
  },
  triggerSetup: async () => {
    try {
      const res = await fetch('http://localhost:4000/api/setup', { method: 'POST' });
      const data = await res.json();
      return data.queueId;
    } catch (err) {
      console.error('Setup failed:', err);
      return null;
    }
  },
  updateConfig: async (queueId, maxWorkers, isPaused) => {
    // Optimistically set the state locally for instantaneous user feedback
    set({ maxWorkers, isPaused });
    console.log(`Syncing Configuration with backend engine for Queue: ${queueId}`);
  }
}));
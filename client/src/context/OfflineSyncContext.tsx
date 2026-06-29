import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";

interface PendingSOS {
  id: string;
  location: string;
  latitude?: number;
  longitude?: number;
  description: string;
  contactPhone?: string;
  queuedAt: number;
  attempts: number;
}

interface OfflineSyncState {
  isOnline: boolean;
  queueLength: number;
  isSyncing: boolean;
  lastSyncAt: number | null;
  queueSOS: (data: Omit<PendingSOS, "id" | "queuedAt" | "attempts">) => void;
  flushQueue: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncState>({
  isOnline: true,
  queueLength: 0,
  isSyncing: false,
  lastSyncAt: null,
  queueSOS: () => {},
  flushQueue: async () => {},
});

const QUEUE_KEY = "crisisconnect_offline_sos_queue";
const MAX_ATTEMPTS = 5;

function loadQueue(): PendingSOS[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: PendingSOS[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueLength, setQueueLength] = useState(() => loadQueue().length);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const syncLockRef = useRef(false);

  const refreshCount = () => setQueueLength(loadQueue().length);

  const queueSOS = useCallback((data: Omit<PendingSOS, "id" | "queuedAt" | "attempts">) => {
    const queue = loadQueue();
    queue.push({
      ...data,
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      queuedAt: Date.now(),
      attempts: 0,
    });
    saveQueue(queue);
    refreshCount();
  }, []);

  const flushQueue = useCallback(async () => {
    if (syncLockRef.current || !isOnline) return;
    const queue = loadQueue();
    if (queue.length === 0) return;

    syncLockRef.current = true;
    setIsSyncing(true);

    const token = localStorage.getItem("accessToken");
    const remaining: PendingSOS[] = [];

    for (const item of queue) {
      if (item.attempts >= MAX_ATTEMPTS) continue;
      try {
        const res = await fetch("/api/sos", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            location: item.location,
            latitude: item.latitude,
            longitude: item.longitude,
            description: `[OFFLINE-SYNC] ${item.description}`,
            contactNumber: item.contactPhone,
            offlineQueueId: item.id,
            queuedAt: new Date(item.queuedAt).toISOString(),
          }),
        });
        if (!res.ok) {
          remaining.push({ ...item, attempts: item.attempts + 1 });
        }
      } catch {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }

    saveQueue(remaining);
    setLastSyncAt(Date.now());
    refreshCount();
    setIsSyncing(false);
    syncLockRef.current = false;
  }, [isOnline]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline) {
      flushQueue();
    }
  }, [isOnline, flushQueue]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(flushQueue, 60_000);
    return () => clearInterval(interval);
  }, [isOnline, flushQueue]);

  return (
    <OfflineSyncContext.Provider value={{ isOnline, queueLength, isSyncing, lastSyncAt, queueSOS, flushQueue }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  return useContext(OfflineSyncContext);
}

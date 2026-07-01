import { QueryClient, QueryFunction, QueryCache, MutationCache } from "@tanstack/react-query";

// ─── Auth header helper ──────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Response validator ──────────────────────────────────────────────────────

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// ─── Proactive token refresh ─────────────────────────────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(ok: boolean) => void> = [];

async function attemptTokenRefresh(): Promise<boolean> {
  if (isRefreshing) {
    return new Promise((resolve) => refreshQueue.push(resolve));
  }
  isRefreshing = true;
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const { accessToken } = await res.json();
      if (accessToken) {
        localStorage.setItem("accessToken", accessToken);
        refreshQueue.forEach((cb) => cb(true));
        refreshQueue = [];
        isRefreshing = false;
        return true;
      }
    }
    refreshQueue.forEach((cb) => cb(false));
    refreshQueue = [];
    isRefreshing = false;
    return false;
  } catch {
    refreshQueue.forEach((cb) => cb(false));
    refreshQueue = [];
    isRefreshing = false;
    return false;
  }
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

export async function apiRequest<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...options?.headers,
    },
    credentials: "include",
  });

  // On 401: attempt one silent token refresh before giving up
  if (res.status === 401 && !url.includes("/api/auth/")) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      const retryRes = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
          ...options?.headers,
        },
        credentials: "include",
      });
      await throwIfResNotOk(retryRes);
      return retryRes.json();
    }
  }

  await throwIfResNotOk(res);
  return res.json();
}

// ─── Query function factory ──────────────────────────────────────────────────

type UnauthorizedBehavior = "returnNull" | "throw";

export function getQueryFn<T>(options: { on401: UnauthorizedBehavior }): QueryFunction<T> {
  return async ({ queryKey }) => {
    const url = queryKey[0] as string;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
      credentials: "include",
    });

    // On 401: attempt one silent token refresh before returning null or throwing
    if (res.status === 401 && !url.includes("/api/auth/")) {
      const refreshed = await attemptTokenRefresh();
      if (refreshed) {
        const retryRes = await fetch(url, {
          headers: getAuthHeaders(),
          credentials: "include",
        });
        if (options.on401 === "returnNull" && retryRes.status === 401) return null as T;
        await throwIfResNotOk(retryRes);
        return retryRes.json() as Promise<T>;
      }
      if (options.on401 === "returnNull") return null as T;
    }

    if (options.on401 === "returnNull" && res.status === 401) return null as T;
    await throwIfResNotOk(res);
    return res.json() as Promise<T>;
  };
}

// ─── Global error handler ────────────────────────────────────────────────────

function handleGlobalError(error: Error) {
  // 401 after refresh attempt failed → clear token and redirect to login
  if (error.message.startsWith("401:")) {
    localStorage.removeItem("accessToken");
    // Avoid redirect loop on auth endpoints
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    return;
  }
  // 403 → log in dev only
  if (error.message.startsWith("403:")) {
    if (import.meta.env.DEV) console.warn("[API] 403 Forbidden:", error.message);
  }
}

// ─── QueryClient ─────────────────────────────────────────────────────────────

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => handleGlobalError(error as Error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => handleGlobalError(error as Error),
  }),
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      // Crisis data: 30 s stale time — balance freshness vs. request rate
      staleTime: 30_000,
      // Retry up to 3× with exponential back-off — skip auth errors immediately
      retry: (failureCount, error: any) => {
        if (error?.message?.startsWith("401:") || error?.message?.startsWith("403:")) {
          return false; // auth errors are not retriable
        }
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
    },
    mutations: {
      retry: false,
    },
  },
});

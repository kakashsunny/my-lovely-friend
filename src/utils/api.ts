/**
 * Resilient API Client
 * Safely handles JSON parsing, network errors, and non-JSON proxy/HTML responses
 * (such as when container is cold-starting or restarting).
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  questionId?: string;
  reason?: string;
}

export interface SafeFetchOptions extends RequestInit {
  retries?: number;
  retryDelayMs?: number;
  silent?: boolean;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: SafeFetchOptions
): Promise<ApiResponse<T>> {
  const maxRetries = init?.retries ?? (init?.method && init.method !== 'GET' ? 0 : 2);
  const retryDelay = init?.retryDelayMs ?? 800;
  const silent = init?.silent ?? false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(input, init);
      const contentType = response.headers.get('content-type') || '';

      // Check if response is JSON
      if (contentType.includes('application/json')) {
        try {
          const data = await response.json();
          if (!response.ok) {
            return {
              ok: false,
              status: response.status,
              data,
              error: data?.error || `Request failed (${response.status})`,
              questionId: data?.questionId,
              reason: data?.reason,
            };
          }
          return {
            ok: true,
            status: response.status,
            data,
          };
        } catch (parseErr) {
          return {
            ok: false,
            status: response.status,
            error: 'The server returned an unexpected response. Please try again.',
          };
        }
      }

      // Non-JSON response (e.g. HTML error page from Cloud Run / Nginx / Vite)
      const rawText = await response.text().catch(() => '');
      if (!silent) {
        console.warn(`[API] Non-JSON response from ${input.toString()} (${response.status}):`, rawText.slice(0, 120));
      }

      // If server is 502/503 during restart, retry if attempts remain
      if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
        continue;
      }

      let friendlyError = 'Unable to connect to the quiz service. Please try again in a moment.';
      if (rawText.includes('<!DOCTYPE') || rawText.includes('<html')) {
        friendlyError = 'Backend API is currently offline on your host. If deploying on Vercel, please check your Vercel deployment log to ensure the build succeeded and no conflicting files exist.';
      } else if (response.status === 404) {
        friendlyError = 'The requested quiz or service was not found. Please verify the link.';
      } else if (response.status === 504) {
        friendlyError = 'Database connection timed out. If using MongoDB Atlas, ensure Network Access allows 0.0.0.0/0.';
      } else if (response.status >= 500) {
        friendlyError = 'Server is currently starting up or updating. If you are on Vercel, please check your Vercel Dashboard to ensure your latest deployment build succeeded.';
      } else if (response.status === 403 || response.status === 401) {
        friendlyError = 'Permission denied. Please check your link or credentials.';
      }

      return {
        ok: false,
        status: response.status,
        error: friendlyError,
      };
    } catch (netErr: any) {
      // If we have retries left (e.g. server was restarting for 1 second), wait and retry
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelay * (attempt + 1)));
        continue;
      }

      if (!silent) {
        console.warn(`[API] Network notice fetching ${input.toString()}:`, netErr?.message || netErr);
      }
      return {
        ok: false,
        status: 0,
        error: 'Network connection was interrupted. Please try again in a few moments.',
      };
    }
  }

  return {
    ok: false,
    status: 0,
    error: 'Unable to reach the server. Please check your connection.',
  };
}

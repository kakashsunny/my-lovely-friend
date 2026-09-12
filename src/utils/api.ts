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

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResponse<T>> {
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
    console.warn(`[API] Non-JSON response from ${input.toString()} (${response.status}):`, rawText.slice(0, 120));

    let friendlyError = 'Unable to connect to the quiz service. Please try again in a moment.';
    if (response.status === 404) {
      friendlyError = 'The requested quiz or service was not found. Please verify the link.';
    } else if (response.status >= 500) {
      friendlyError = 'Server is currently waking up or updating. Please try again in a few seconds.';
    } else if (response.status === 403 || response.status === 401) {
      friendlyError = 'Permission denied. Please check your link or credentials.';
    }

    return {
      ok: false,
      status: response.status,
      error: friendlyError,
    };
  } catch (netErr: any) {
    console.error(`[API] Network error fetching ${input.toString()}:`, netErr);
    return {
      ok: false,
      status: 0,
      error: 'Network error. Please check your connection and try again.',
    };
  }
}

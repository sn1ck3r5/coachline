import {
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  getRefreshToken,
  clearTokens,
} from "./storage";

// API routes live under /api/* on the server — avoids collisions with
// Next.js page paths now that the web frontend and API share an origin.
const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001") + "/api";

class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await getAccessToken();
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (response.status === 401 && token) {
      const refreshed = await this.refresh();
      if (refreshed) {
        const newToken = await getAccessToken();
        const retryResponse = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });
        if (!retryResponse.ok)
          throw new ApiError(retryResponse.status, await retryResponse.text());
        return retryResponse.json();
      }
      throw new ApiError(401, "Session expired");
    }

    if (!response.ok)
      throw new ApiError(response.status, await response.text());
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  private async refresh(): Promise<boolean> {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        await clearTokens();
        return false;
      }
      const data = await response.json();
      await setAccessToken(data.accessToken);
      await setRefreshToken(data.refreshToken);
      return true;
    } catch {
      await clearTokens();
      return false;
    }
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }
  delete(path: string) {
    return this.request<void>(path, { method: "DELETE" });
  }
}

class ApiError extends Error {
  constructor(
    public status: number,
    public body: string
  ) {
    super(`API Error ${status}: ${body}`);
  }
}

export const api = new ApiClient();

// Defaults to same-origin (empty prefix). For local dev against a
// separate API process, set NEXT_PUBLIC_API_URL=http://localhost:3001.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("coachline_access_token") : null;

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
        const newToken = localStorage.getItem("coachline_access_token");
        const retryResponse = await fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${newToken}`,
            ...options.headers,
          },
        });
        if (!retryResponse.ok) throw new Error(`API Error ${retryResponse.status}`);
        return retryResponse.json();
      }
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Session expired");
    }

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${await response.text()}`);
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  private async refresh(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem("coachline_refresh_token");
      if (!refreshToken) return false;
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) {
        localStorage.removeItem("coachline_access_token");
        localStorage.removeItem("coachline_refresh_token");
        return false;
      }
      const data = await response.json();
      localStorage.setItem("coachline_access_token", data.accessToken);
      localStorage.setItem("coachline_refresh_token", data.refreshToken);
      return true;
    } catch {
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
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete(path: string) {
    return this.request<void>(path, { method: "DELETE" });
  }

  async uploadFile(url: string, file: File): Promise<void> {
    const response = await fetch(url, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  }
}

export const api = new ApiClient();

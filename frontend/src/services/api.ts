import type {
  Drop,
  DropRangeType,
  EffectType,
  User,
  Notification,
} from "../types";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export const api = {
  auth: {
    signInWithApple: async (
      identityToken: string,
      authorizationCode: string
    ) => {
      const result = await request<{ user: User; token: string }>(
        "/auth/apple",
        {
          method: "POST",
          body: JSON.stringify({ identityToken, authorizationCode }),
        }
      );
      localStorage.setItem("auth_token", result.token);
      return result.user;
    },

    getCurrentUser: () => request<User>("/auth/me"),

    updateUsername: (name: string) =>
      request<User>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),

    generateUsername: () =>
      request<User>("/auth/me/generate-username", {
        method: "POST",
      }),

    signOut: () => {
      localStorage.removeItem("auth_token");
    },
  },

  drops: {
    getAll: (lat: number, lng: number, radius: number = 1000) =>
      request<Drop[]>(`/drops?lat=${lat}&lng=${lng}&radius=${radius}`),

    create: (
      message: string,
      latitude: number,
      longitude: number,
      range: DropRangeType = "close",
      effect: EffectType = "none",
      expiresAt: string | null = null
    ) =>
      request<Drop>("/drops", {
        method: "POST",
        body: JSON.stringify({
          message,
          latitude,
          longitude,
          range,
          effect,
          expiresAt,
        }),
      }),

    getById: (id: string) => request<Drop>(`/drops/${id}`),

    delete: (id: string) =>
      request<{ success: boolean }>(`/drops/${id}`, {
        method: "DELETE",
      }),

    highfive: (id: string) =>
      request<{ success: boolean; highfiveCount: number }>(
        `/drops/${id}/highfive`,
        { method: "POST" }
      ),

    unhighfive: (id: string) =>
      request<{ success: boolean; highfiveCount: number }>(
        `/drops/${id}/highfive`,
        { method: "DELETE" }
      ),

    hasHighfived: (id: string) =>
      request<{ hasHighfived: boolean }>(`/drops/${id}/highfive`),
  },

  notifications: {
    getAll: () => request<Notification[]>("/notifications"),

    getUnreadCount: () =>
      request<{ count: number }>("/notifications/unread-count"),

    markAsRead: (id: string) =>
      request<{ success: boolean }>(`/notifications/${id}/read`, {
        method: "PATCH",
      }),

    markAllAsRead: () =>
      request<{ success: boolean }>("/notifications/read-all", {
        method: "POST",
      }),
  },

  vibe: {
    list: () =>
      request<{
        vibes: Array<{
          id: string;
          name: string;
          branchName: string;
          hasChanges: boolean;
          changedFiles: string[];
          aheadBy: number;
          createdAt: string;
        }>;
      }>("/vibe"),

    create: (name: string) =>
      request<{
        id: string;
        name: string;
        branchName: string;
        createdAt: string;
      }>("/vibe", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),

    get: (vibeId: string) =>
      request<{
        id: string;
        name: string;
        branchName: string;
        hasChanges: boolean;
        changedFiles: string[];
        aheadBy: number;
        behindBy: number;
        createdAt: string;
      }>(`/vibe/${vibeId}`),

    delete: (vibeId: string) =>
      request<{ success: boolean }>(`/vibe/${vibeId}`, {
        method: "DELETE",
      }),

    chat: (vibeId: string, message: string) =>
      request<{
        message: string;
        toolsUsed?: string[];
        vibe: {
          id: string;
          name: string;
          branchName: string;
          hasChanges: boolean;
          changedFiles: string[];
          aheadBy: number;
        };
      }>(`/vibe/${vibeId}/chat`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),

    chatStream: (
      vibeId: string,
      message: string,
      onEvent: (event: {
        type:
          | "status"
          | "tool_start"
          | "tool_end"
          | "done"
          | "error"
          | "deployment";
        message?: string;
        tool?: string;
        path?: string;
        success?: boolean;
        toolsUsed?: string[];
        state?: "QUEUED" | "BUILDING" | "READY" | "ERROR";
        url?: string;
        vibe?: {
          id: string;
          name: string;
          branchName: string;
          hasChanges: boolean;
          changedFiles: string[];
          aheadBy: number;
        };
      }) => void
    ) => {
      const token = localStorage.getItem("auth_token");
      return fetch(`${API_BASE}/vibe/${vibeId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ message }),
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ message: "Request failed" }));
          throw new Error(err.message || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                onEvent(data);
              } catch (e) {
                console.error("Failed to parse SSE:", line);
              }
            }
          }
        }
      });
    },

    openPR: (vibeId: string, title?: string, body?: string) =>
      request<{ prNumber: number; prUrl: string }>(`/vibe/${vibeId}/pr`, {
        method: "POST",
        body: JSON.stringify({ title, body }),
      }),

    revert: (vibeId: string) =>
      request<{ success: boolean; message: string }>(`/vibe/${vibeId}/revert`, {
        method: "POST",
      }),

    getPreviewUrl: (vibeId: string) =>
      request<{ previewUrl: string; branch: string }>(
        `/vibe/${vibeId}/preview-url`
      ),

    clearHistory: (vibeId: string) =>
      request<{ success: boolean }>(`/vibe/${vibeId}/history`, {
        method: "DELETE",
      }),

    getMessages: (vibeId: string) =>
      request<{
        messages: Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          createdAt: string;
        }>;
      }>(`/vibe/${vibeId}/messages`),

    getFile: (vibeId: string, path: string) =>
      request<{ content: string; sha: string }>(
        `/vibe/${vibeId}/file?path=${encodeURIComponent(path)}`
      ),

    listFiles: (vibeId: string, path: string = "") =>
      request<{
        files: { name: string; path: string; type: "file" | "dir" }[];
      }>(`/vibe/${vibeId}/files?path=${encodeURIComponent(path)}`),
  },
};

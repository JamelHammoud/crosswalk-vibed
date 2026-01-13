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
};

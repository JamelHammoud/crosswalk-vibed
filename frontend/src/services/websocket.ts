import type { Drop } from "../types";

type NewDropHandler = (drop: Drop) => void;
type DeleteDropHandler = (dropId: string) => void;

interface HighfiveEvent {
  dropId: string;
  toUserId: string;
  fromUserId: string;
  fromUserName: string | null;
  notificationId: string;
}

type HighfiveHandler = (event: HighfiveEvent) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private newDropHandlers: Set<NewDropHandler> = new Set();
  private deleteDropHandlers: Set<DeleteDropHandler> = new Set();
  private highfiveHandlers: Set<HighfiveHandler> = new Set();
  private reconnectTimeout: number | null = null;
  private isConnecting = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws";

    console.log("Connecting to WebSocket:", wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log("WebSocket connected");
        this.isConnecting = false;
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_drop" && data.drop) {
            this.newDropHandlers.forEach((handler) => handler(data.drop));
          } else if (data.type === "delete_drop" && data.dropId) {
            this.deleteDropHandlers.forEach((handler) => handler(data.dropId));
          } else if (data.type === "highfive" && data.dropId) {
            this.highfiveHandlers.forEach((handler) =>
              handler({
                dropId: data.dropId,
                toUserId: data.toUserId,
                fromUserId: data.fromUserId,
                fromUserName: data.fromUserName,
                notificationId: data.notificationId,
              })
            );
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket disconnected");
        this.isConnecting = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        this.isConnecting = false;
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onNewDrop(handler: NewDropHandler) {
    this.newDropHandlers.add(handler);
    return () => {
      this.newDropHandlers.delete(handler);
    };
  }

  onDeleteDrop(handler: DeleteDropHandler) {
    this.deleteDropHandlers.add(handler);
    return () => {
      this.deleteDropHandlers.delete(handler);
    };
  }

  onHighfive(handler: HighfiveHandler) {
    this.highfiveHandlers.add(handler);
    return () => {
      this.highfiveHandlers.delete(handler);
    };
  }
}

export const wsService = new WebSocketService();

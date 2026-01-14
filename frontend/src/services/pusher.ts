import Pusher from "pusher-js";
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

class PusherService {
  private pusher: Pusher | null = null;
  private dropsChannel: any = null;
  private userChannel: any = null;
  private newDropHandlers: Set<NewDropHandler> = new Set();
  private deleteDropHandlers: Set<DeleteDropHandler> = new Set();
  private highfiveHandlers: Set<HighfiveHandler> = new Set();
  private currentUserId: string | null = null;

  connect(userId?: string) {
    if (this.pusher) return;

    console.log("Connecting to Pusher...");

    this.pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
      cluster: import.meta.env.VITE_PUSHER_CLUSTER || "mt1",
    });

    // Subscribe to drops channel for new/deleted drops
    this.dropsChannel = this.pusher.subscribe("drops");

    this.dropsChannel.bind("new_drop", (drop: Drop) => {
      console.log("Pusher: new_drop", drop);
      this.newDropHandlers.forEach((handler) => handler(drop));
    });

    this.dropsChannel.bind("delete_drop", (data: { id: string }) => {
      console.log("Pusher: delete_drop", data);
      this.deleteDropHandlers.forEach((handler) => handler(data.id));
    });

    // Subscribe to user-specific channel for highfives if userId provided
    if (userId) {
      this.subscribeToUserChannel(userId);
    }

    this.pusher.connection.bind("connected", () => {
      console.log("Pusher connected");
    });

    this.pusher.connection.bind("error", (err: any) => {
      console.error("Pusher error:", err);
    });
  }

  subscribeToUserChannel(userId: string) {
    if (!this.pusher) return;

    // Unsubscribe from previous user channel if different
    if (this.userChannel && this.currentUserId !== userId) {
      this.pusher.unsubscribe(`user-${this.currentUserId}`);
    }

    this.currentUserId = userId;
    this.userChannel = this.pusher.subscribe(`user-${userId}`);

    this.userChannel.bind("highfive", (event: HighfiveEvent) => {
      console.log("Pusher: highfive", event);
      this.highfiveHandlers.forEach((handler) => handler(event));
    });
  }

  disconnect() {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
      this.dropsChannel = null;
      this.userChannel = null;
      this.currentUserId = null;
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

export const pusherService = new PusherService();

// Also export with wsService name for backwards compatibility
export const wsService = pusherService;

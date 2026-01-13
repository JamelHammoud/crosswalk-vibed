import type { ServerWebSocket } from "bun";
import type { Drop } from "../types";

interface HighfiveEvent {
  dropId: string;
  toUserId: string;
  fromUserId: string;
  fromUserName: string | null;
  notificationId: string;
}

const clients = new Set<ServerWebSocket<unknown>>();

export function addClient(ws: ServerWebSocket<unknown>) {
  clients.add(ws);
  console.log(`WebSocket client connected. Total: ${clients.size}`);
}

export function removeClient(ws: ServerWebSocket<unknown>) {
  clients.delete(ws);
  console.log(`WebSocket client disconnected. Total: ${clients.size}`);
}

export function broadcastNewDrop(drop: Drop) {
  const message = JSON.stringify({ type: "new_drop", drop });
  for (const client of clients) {
    try {
      client.send(message);
    } catch (err) {
      console.error("Failed to send to client:", err);
      clients.delete(client);
    }
  }
}

export function broadcastDeleteDrop(dropId: string) {
  const message = JSON.stringify({ type: "delete_drop", dropId });
  for (const client of clients) {
    try {
      client.send(message);
    } catch (err) {
      console.error("Failed to send to client:", err);
      clients.delete(client);
    }
  }
}

export function broadcastHighfive(event: HighfiveEvent) {
  const message = JSON.stringify({ type: "highfive", ...event });
  for (const client of clients) {
    try {
      client.send(message);
    } catch (err) {
      console.error("Failed to send to client:", err);
      clients.delete(client);
    }
  }
}

export function getClientCount() {
  return clients.size;
}

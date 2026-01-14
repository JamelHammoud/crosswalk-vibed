import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER || "mt1",
  useTLS: true,
});

export function broadcastNewDrop(drop: any) {
  pusher.trigger("drops", "new_drop", drop);
}

export function broadcastDeleteDrop(dropId: string) {
  pusher.trigger("drops", "delete_drop", { id: dropId });
}

export function broadcastHighfive(data: {
  dropId: string;
  toUserId: string;
  fromUserId: string;
  fromUserName: string | null;
  notificationId: string;
}) {
  // Send to user-specific channel so only they receive it
  pusher.trigger(`user-${data.toUserId}`, "highfive", data);
}

export { pusher };

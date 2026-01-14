import Pusher from "pusher";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER || "mt1",
  useTLS: true,
});

export async function broadcastNewDrop(drop: any) {
  try {
    await pusher.trigger("drops", "new_drop", drop);
    console.log("Pusher: broadcasted new_drop", drop.id);
  } catch (err) {
    console.error("Pusher broadcast error (new_drop):", err);
  }
}

export async function broadcastDeleteDrop(dropId: string) {
  try {
    await pusher.trigger("drops", "delete_drop", { id: dropId });
    console.log("Pusher: broadcasted delete_drop", dropId);
  } catch (err) {
    console.error("Pusher broadcast error (delete_drop):", err);
  }
}

export async function broadcastHighfive(data: {
  dropId: string;
  toUserId: string;
  fromUserId: string;
  fromUserName: string | null;
  notificationId: string;
}) {
  try {
    await pusher.trigger(`user-${data.toUserId}`, "highfive", data);
    console.log("Pusher: broadcasted highfive to user", data.toUserId);
  } catch (err) {
    console.error("Pusher broadcast error (highfive):", err);
  }
}

export { pusher };

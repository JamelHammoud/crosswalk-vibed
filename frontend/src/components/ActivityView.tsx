import { useEffect, useState } from "react";
import { useAppStore } from "../stores/app";
import { api } from "../services/api";
import { wsService } from "../services/pusher";
import type { Notification } from "../types";

type FilterType = "all" | "around" | "comments";

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export function ActivityView() {
  const {
    user,
    notifications,
    setNotifications,
    setUnreadCount,
    setActiveTab,
    setFocusDropId,
    markNotificationAsRead,
  } = useAppStore();

  const [filter, setFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications();

    const unsubscribeHighfive = wsService.onHighfive((event) => {
      if (event.toUserId === user?.id) {
        const newNotification: Notification = {
          id: event.notificationId,
          type: "highfive",
          dropId: event.dropId,
          fromUserId: event.fromUserId,
          fromUserName: event.fromUserName,
          read: false,
          createdAt: new Date().toISOString(),
        };
        useAppStore.getState().addNotification(newNotification);
      }
    });

    return () => {
      unsubscribeHighfive();
    };
  }, [user?.id]);

  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const [notifs, unread] = await Promise.all([
        api.notifications.getAll(),
        api.notifications.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(unread.count);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await api.notifications.markAsRead(notification.id);
      markNotificationAsRead(notification.id);
    }

    if (notification.dropId) {
      setFocusDropId(notification.dropId);
      setActiveTab("map");
    }
  };

  const filteredNotifications = notifications.filter((_n) => {
    if (filter === "all") return true;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-2xl font-bold text-ink mb-4">Activity</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all ${
              filter === "all" ? "bg-ink text-white" : "bg-[#F5F1F0] text-ink"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("around")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all ${
              filter === "around"
                ? "bg-ink text-white"
                : "bg-[#F5F1F0] text-ink"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
            Around
          </button>
          <button
            onClick={() => setFilter("comments")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all ${
              filter === "comments"
                ? "bg-ink text-white"
                : "bg-[#F5F1F0] text-ink"
            }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 22 22" fill="currentColor">
              <path d="M16.8337 4.24939C18.3484 5.76385 19.2146 7.808 19.2493 9.94961C19.2841 12.0912 18.4845 14.1624 17.0198 15.7251L16.8337 15.9176L12.9443 19.8061C12.4508 20.2993 11.7883 20.5865 11.0909 20.6095C10.3936 20.6325 9.71362 20.3895 9.18872 19.9299L9.05672 19.8061L5.16638 15.9167C3.6192 14.3695 2.75 12.2711 2.75 10.0831C2.75 7.89501 3.6192 5.79658 5.16638 4.24939C6.71357 2.70221 8.812 1.83301 11.0001 1.83301C13.1881 1.83301 15.2865 2.70221 16.8337 4.24939ZM11.0001 7.33306C10.6389 7.33306 10.2813 7.40419 9.94767 7.54239C9.61403 7.68059 9.31087 7.88315 9.05551 8.13851C8.80015 8.39388 8.59758 8.69703 8.45938 9.03068C8.32118 9.36432 8.25005 9.72192 8.25005 10.0831C8.25005 10.4442 8.32118 10.8018 8.45938 11.1354C8.59758 11.4691 8.80015 11.7722 9.05551 12.0276C9.31087 12.283 9.61403 12.4855 9.94767 12.6237C10.2813 12.7619 10.6389 12.8331 11.0001 12.8331C11.7294 12.8331 12.4289 12.5433 12.9446 12.0276C13.4603 11.5119 13.7501 10.8124 13.7501 10.0831C13.7501 9.35371 13.4603 8.65424 12.9446 8.13851C12.4289 7.62279 11.7294 7.33306 11.0001 7.33306Z" />
            </svg>
            Comments
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-32">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-2 border-ink/20 border-t-ink rounded-full animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink/50">
            <svg
              className="w-16 h-16 mb-4"
              viewBox="0 0 32 32"
              fill="currentColor"
              opacity="0.3"
            >
              <path d="M19.2277 26.5C20.4769 26.5 21.1368 28.036 20.3036 29.002C19.7618 29.6306 19.0985 30.1334 18.3569 30.4777C17.6154 30.822 16.8123 31 16 31C15.1878 31 14.3847 30.822 13.6431 30.4777C12.9016 30.1334 12.2383 29.6306 11.6965 29.002C10.8993 28.078 11.4683 26.6335 12.6121 26.5105L12.7709 26.5015L19.2277 26.5ZM16 1C17.9612 1 19.619 2.3545 20.1519 4.2115L20.2184 4.468L20.2299 4.5325C21.8221 5.46507 23.1789 6.7763 24.1891 8.3587C25.1992 9.94109 25.8339 11.7496 26.0411 13.636L26.0816 14.0665L26.109 14.5V18.8965L26.1393 19.1005C26.3371 20.2057 26.9259 21.1941 27.79 21.871L28.0312 22.0465L28.2651 22.195C29.5071 22.9255 29.0738 24.844 27.7207 24.991L27.5532 25H4.44689C2.96231 25 2.44386 22.954 3.73492 22.195C4.28519 21.8716 4.76062 21.4269 5.12786 20.8924C5.49509 20.3578 5.74523 19.7462 5.8607 19.1005L5.89103 18.886L5.89247 14.431C5.98053 12.4718 6.52957 10.5649 7.49155 8.8772C8.45353 7.18949 9.79912 5.77241 11.4105 4.75L11.7687 4.531L11.7831 4.4665C11.9868 3.56924 12.4509 2.75862 13.1127 2.14427C13.7744 1.52992 14.6018 1.14148 15.483 1.0315L15.7459 1.006L16 1Z" />
            </svg>
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs mt-1">High-fives will show up here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all ${
                  notification.read
                    ? "bg-gray-50 hover:bg-gray-100"
                    : "bg-primary/10 hover:bg-primary/20"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary flex items-center justify-center text-lg shrink-0">
                  🙌
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">
                    <span className="font-bold">
                      {notification.fromUserName || "Someone"}
                    </span>{" "}
                    high-fived your drop
                  </p>
                  <p className="text-xs text-ink/50 mt-0.5">
                    {formatTimeAgo(notification.createdAt)}
                  </p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

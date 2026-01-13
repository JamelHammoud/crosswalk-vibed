export interface User {
  id: string;
  email: string | null;
  name: string | null;
  appleUserId: string;
}

export type DropRangeType = "close" | "far" | "anywhere";

export type EffectType =
  | "none"
  | "confetti"
  | "rainbow"
  | "stars"
  | "spooky"
  | "gross"
  | "uhoh";

export interface Drop {
  id: string;
  userId: string;
  message: string;
  latitude: number;
  longitude: number;
  range: DropRangeType;
  effect: EffectType;
  expiresAt: string | null;
  createdAt: string;
  userName: string | null;
  highfiveCount?: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface Notification {
  id: string;
  type: "highfive";
  dropId: string | null;
  fromUserId: string | null;
  fromUserName: string | null;
  read: boolean;
  createdAt: string;
}

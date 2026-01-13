export interface Drop {
  id: string;
  userId: string;
  message: string;
  latitude: number;
  longitude: number;
  range?: string;
  effect?: string;
  expiresAt?: string | null;
  createdAt: string;
  userName: string | null;
  highfiveCount?: number;
}

export interface User {
  id: string;
  appleUserId: string;
  email: string | null;
  name: string | null;
  createdAt: string;
}

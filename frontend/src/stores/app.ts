import { create } from "zustand";
import type { Drop, Location, User, Notification } from "../types";
import {
  ThemeColor,
  DEFAULT_THEME_COLOR,
  getStoredThemeColor,
  setStoredThemeColor,
  applyThemeColor,
} from "../constants/theme";

type TabType = "map" | "activity";

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  currentLocation: Location | null;
  drops: Drop[];
  selectedDrop: Drop | null;
  isDrawerOpen: boolean;
  isComposerOpen: boolean;
  isLoading: boolean;
  error: string | null;
  themeColor: ThemeColor;
  activeTab: TabType;
  notifications: Notification[];
  unreadCount: number;
  isProfileOpen: boolean;
  focusDropId: string | null;

  setUser: (user: User | null) => void;
  setLocation: (location: Location) => void;
  setDrops: (drops: Drop[]) => void;
  addDrop: (drop: Drop) => void;
  removeDrop: (dropId: string) => void;
  updateDropHighfiveCount: (dropId: string, count: number) => void;
  selectDrop: (drop: Drop | null) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  openComposer: () => void;
  closeComposer: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setThemeColor: (color: ThemeColor) => void;
  setActiveTab: (tab: TabType) => void;
  setNotifications: (notifications: Notification[]) => void;
  addNotification: (notification: Notification) => void;
  markNotificationAsRead: (id: string) => void;
  setUnreadCount: (count: number) => void;
  setProfileOpen: (open: boolean) => void;
  setFocusDropId: (dropId: string | null) => void;
  reset: () => void;
}

const initialThemeColor = getStoredThemeColor();
applyThemeColor(initialThemeColor);

export const useAppStore = create<AppState>((set) => ({
  user: null,
  isAuthenticated: false,
  currentLocation: null,
  drops: [],
  selectedDrop: null,
  isDrawerOpen: false,
  isComposerOpen: false,
  isLoading: false,
  error: null,
  themeColor: initialThemeColor,
  activeTab: "map",
  notifications: [],
  unreadCount: 0,
  isProfileOpen: false,
  focusDropId: null,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLocation: (location) => set({ currentLocation: location }),
  setDrops: (drops) => set({ drops }),
  addDrop: (drop) =>
    set((state) => {
      if (state.drops.some((d) => d.id === drop.id)) return state;
      return { drops: [drop, ...state.drops] };
    }),
  removeDrop: (dropId) =>
    set((state) => ({
      drops: state.drops.filter((d) => d.id !== dropId),
      selectedDrop:
        state.selectedDrop?.id === dropId ? null : state.selectedDrop,
      isDrawerOpen:
        state.selectedDrop?.id === dropId ? false : state.isDrawerOpen,
    })),
  updateDropHighfiveCount: (dropId, count) =>
    set((state) => ({
      drops: state.drops.map((d) =>
        d.id === dropId ? { ...d, highfiveCount: count } : d
      ),
      selectedDrop:
        state.selectedDrop?.id === dropId
          ? { ...state.selectedDrop, highfiveCount: count }
          : state.selectedDrop,
    })),
  selectDrop: (drop) => set({ selectedDrop: drop, isDrawerOpen: !!drop }),
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false, selectedDrop: null }),
  openComposer: () => set({ isComposerOpen: true }),
  closeComposer: () => set({ isComposerOpen: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setThemeColor: (color) => {
    setStoredThemeColor(color);
    set({ themeColor: color });
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
  markNotificationAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  setUnreadCount: (count) => set({ unreadCount: count }),
  setProfileOpen: (open) => set({ isProfileOpen: open }),
  setFocusDropId: (dropId) => set({ focusDropId: dropId }),
  reset: () =>
    set({
      user: null,
      isAuthenticated: false,
      currentLocation: null,
      drops: [],
      selectedDrop: null,
      isDrawerOpen: false,
      isComposerOpen: false,
      isLoading: false,
      error: null,
      themeColor: DEFAULT_THEME_COLOR,
      activeTab: "map",
      notifications: [],
      unreadCount: 0,
      isProfileOpen: false,
      focusDropId: null,
    }),
}));

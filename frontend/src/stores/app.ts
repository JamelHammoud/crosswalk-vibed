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
  isDarkMode: boolean;

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
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
  reset: () => void;
}

// Helper functions for dark mode persistence
const getStoredDarkMode = (): boolean => {
  const stored = localStorage.getItem("crosswalk-dark-mode");
  return stored === "true";
};

const setStoredDarkMode = (isDark: boolean): void => {
  localStorage.setItem("crosswalk-dark-mode", String(isDark));
};

const applyDarkMode = (isDark: boolean): void => {
  if (isDark) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

// Initialize theme color and dark mode
const initialThemeColor = getStoredThemeColor();
const initialDarkMode = getStoredDarkMode();
applyThemeColor(initialThemeColor);
applyDarkMode(initialDarkMode);

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
  isDarkMode: initialDarkMode,

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
  toggleDarkMode: () =>
    set((state) => {
      const newDarkMode = !state.isDarkMode;
      setStoredDarkMode(newDarkMode);
      applyDarkMode(newDarkMode);
      return { isDarkMode: newDarkMode };
    }),
  setDarkMode: (isDark) => {
    setStoredDarkMode(isDark);
    applyDarkMode(isDark);
    set({ isDarkMode: isDark });
  },
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
      isDarkMode: false,
    }),
}));
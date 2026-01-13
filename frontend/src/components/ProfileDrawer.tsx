import { useState } from "react";
import { useAppStore } from "../stores/app";
import { api } from "../services/api";
import { THEME_COLORS } from "../constants/theme";
import { VibeChat } from "./VibeChat";

interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export function ProfileDrawer({
  isOpen,
  onClose,
  onSignOut,
}: ProfileDrawerProps) {
  const { user, setUser, themeColor, setThemeColor } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVibeChatOpen, setIsVibeChatOpen] = useState(false);

  if (!isOpen && !isVibeChatOpen) return null;

  const handleSave = async () => {
    if (!username.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const updatedUser = await api.auth.updateUsername(username.trim());
      setUser(updatedUser);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedUser = await api.auth.generateUsername();
      setUser(updatedUser);
      setUsername(updatedUser.name || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    onClose();
    onSignOut();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 animate-slide-up">
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3" />
        <div className="p-6 safe-area-bottom">
          <h2 className="text-xl font-bold text-ink mb-6">Profile</h2>

          <div className="space-y-5">
            <div>
              <label className="text-gray-500 text-sm mb-2 block">
                Theme Color
              </label>
              <div className="flex gap-3">
                {THEME_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setThemeColor(color.id)}
                    className={`w-12 h-12 rounded-full transition-all ${
                      themeColor === color.id
                        ? "ring-2 ring-offset-2 ring-gray-400 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.id }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-500 text-sm mb-2 block">
                Username
              </label>
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="flex-1 h-12 bg-gray-100 border border-gray-200 rounded-xl px-4 text-ink focus:outline-none focus:ring-2 focus:ring-gray-300"
                    placeholder="Enter username"
                    maxLength={20}
                  />
                  <button
                    onClick={handleSave}
                    disabled={isLoading || !username.trim()}
                    className="h-12 px-4 bg-primary text-ink font-medium rounded-xl disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Save"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-ink text-lg">
                    {user?.name || "No username set"}
                  </span>
                  <button
                    onClick={() => {
                      setUsername(user?.name || "");
                      setIsEditing(true);
                    }}
                    className="text-gray-600 text-sm font-medium"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-12 bg-gray-100 text-ink font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isLoading ? "Generating..." : "Generate Random Username"}
            </button>

            <div className="pt-4 border-t border-gray-200">
              <p className="text-gray-500 text-sm mb-1">Email</p>
              <p className="text-ink">{user?.email || "Private"}</p>
            </div>

            <button
              onClick={() => setIsVibeChatOpen(true)}
              className="w-full h-14 bg-gradient-to-r from-violet-500 via-purple-500 to-fuchsia-500 text-white font-bold rounded-xl flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-shadow"
            >
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3c.132 0 .263 0 .393 0a7.5 7.5 0 0 0 7.92 12.446a9 9 0 1 1 -8.313 -12.454z" />
                <path d="M17 4a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2" />
                <path d="M19 11h2m-1 -1v2" />
              </svg>
              Open Vibe²
            </button>

            <button
              onClick={handleSignOut}
              className="w-full h-12 bg-red-50 text-red-600 font-medium rounded-xl mt-4"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <VibeChat
        isOpen={isVibeChatOpen}
        onClose={() => setIsVibeChatOpen(false)}
      />
    </>
  );
}

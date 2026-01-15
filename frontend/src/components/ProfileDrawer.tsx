import { useState } from "react";
import { useAppStore } from "../stores/app";
import { api } from "../services/api";
import { THEME_COLORS } from "../constants/theme";
import { VibeChat } from "./VibeChat";

// Check if we're on a Vercel preview deployment (not production)
const isPreviewDeployment = () => {
  const hostname = window.location.hostname;
  // Preview URLs have a hash like: crosswalk-vibed-frontend-abc123-team.vercel.app
  // Production is: crosswalk-vibed-frontend.vercel.app or player.scrns.io
  if (hostname.includes("vercel.app")) {
    // If it has -git- or a hash pattern, it's a preview
    return (
      hostname.includes("-git-") || /frontend-[a-z0-9]{6,}-/.test(hostname)
    );
  }
  return false;
};

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
  const { user, setUser, themeColor, setThemeColor, isDarkMode, toggleDarkMode } = useAppStore();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState(user?.name || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVibeChatOpen, setIsVibeChatOpen] = useState(false);
  const showVibeFeature = !isPreviewDeployment();

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

      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl z-50 animate-slide-up">
        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mt-3" />
        <div className="p-6 safe-area-bottom">
          <h2 className="text-xl font-bold text-ink dark:text-white mb-6">Profile</h2>

          <div className="space-y-5">
            <div>
              <label className="text-gray-500 dark:text-gray-400 text-sm mb-2 block">
                Theme Color
              </label>
              <div className="flex gap-3">
                {THEME_COLORS.map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setThemeColor(color.id)}
                    className={`w-12 h-12 rounded-full transition-all ${
                      themeColor === color.id
                        ? "ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 dark:ring-offset-gray-900 scale-110"
                        : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color.id }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-500 dark:text-gray-400 text-sm mb-2 block">
                Dark Mode
              </label>
              <button
                onClick={toggleDarkMode}
                className="w-full h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-between px-4 transition-colors"
              >
                <span className="text-ink dark:text-white font-medium">
                  {isDarkMode ? "Dark Mode" : "Light Mode"}
                </span>
                <div className="relative">
                  <div className={`w-14 h-8 bg-gray-300 dark:bg-gray-600 rounded-full transition-colors`}>
                    <div
                      className={`absolute top-1 w-6 h-6 bg-white dark:bg-gray-900 rounded-full shadow-md transition-transform ${
                        isDarkMode ? "translate-x-7" : "translate-x-1"
                      }`}
                    />
                  </div>
                </div>
              </button>
            </div>

            <div>
              <label className="text-gray-500 dark:text-gray-400 text-sm mb-2 block">
                Username
              </label>
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="flex-1 h-12 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 text-ink dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
                    placeholder="Enter username"
                    maxLength={20}
                  />
                  <button
                    onClick={handleSave}
                    disabled={isLoading || !username.trim()}
                    className="h-12 px-4 bg-primary text-ink dark:text-white font-medium rounded-xl disabled:opacity-50"
                  >
                    {isLoading ? "..." : "Save"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-ink dark:text-white text-lg">
                    {user?.name || "No username set"}
                  </span>
                  <button
                    onClick={() => {
                      setUsername(user?.name || "");
                      setIsEditing(true);
                    }}
                    className="text-gray-600 dark:text-gray-400 text-sm font-medium"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full h-12 bg-gray-100 dark:bg-gray-800 text-ink dark:text-white font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
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

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">Email</p>
              <p className="text-ink dark:text-white">{user?.email || "Private"}</p>
            </div>

            {showVibeFeature && (
              <>
                <button
                  onClick={() => setIsVibeChatOpen(true)}
                  className="group relative w-full h-16 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]"
                >
                  {/* Night sky gradient background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]" />

                  {/* Stars layer */}
                  <div className="absolute inset-0 overflow-hidden">
                    {/* Static stars */}
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[15%] left-[10%] opacity-60" />
                    <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[25%] left-[25%] opacity-40" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[20%] left-[45%] opacity-70" />
                    <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[35%] left-[60%] opacity-50" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[15%] left-[75%] opacity-60" />
                    <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[40%] left-[85%] opacity-40" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[60%] left-[15%] opacity-50" />
                    <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[70%] left-[35%] opacity-60" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[65%] left-[55%] opacity-40" />
                    <div className="absolute w-0.5 h-0.5 bg-white rounded-full top-[75%] left-[70%] opacity-70" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[55%] left-[90%] opacity-50" />

                    {/* Twinkling stars with animation */}
                    <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[20%] left-[20%] animate-[twinkle_2s_ease-in-out_infinite]" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[30%] left-[50%] animate-[twinkle_2.5s_ease-in-out_infinite_0.5s]" />
                    <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[25%] left-[80%] animate-[twinkle_3s_ease-in-out_infinite_1s]" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[60%] left-[30%] animate-[twinkle_2.2s_ease-in-out_infinite_0.3s]" />
                    <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[70%] left-[65%] animate-[twinkle_2.8s_ease-in-out_infinite_0.7s]" />
                    <div className="absolute w-1 h-1 bg-white rounded-full top-[45%] left-[5%] animate-[twinkle_2.4s_ease-in-out_infinite_1.2s]" />
                    <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[50%] left-[95%] animate-[twinkle_3.2s_ease-in-out_infinite_0.9s]" />
                  </div>

                  {/* Subtle glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 via-transparent to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Button text */}
                  <div className="relative z-10 flex items-center justify-center h-full">
                    <span className="text-white font-bold text-lg tracking-wide drop-shadow-lg">
                      Open Vibe²
                    </span>
                  </div>
                </button>

                <style>{`
                  @keyframes twinkle {
                    0%, 100% { opacity: 0.3; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.2); }
                  }
                `}</style>
              </>
            )}

            <button
              onClick={handleSignOut}
              className="w-full h-12 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium rounded-xl mt-4"
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
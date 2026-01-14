import { useEffect, useState } from "react";
import { useAppStore } from "./stores/app";
import { AuthScreen } from "./components/AuthScreen";
import { MapView } from "./components/MapView";
import { api } from "./services/api";

const DEV_BYPASS_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

export function App() {
  const { isAuthenticated, setUser } = useAppStore();
  const [isProcessingCallback, setIsProcessingCallback] = useState(() => {
    // Check if we have vibe_token on initial render
    const params = new URLSearchParams(window.location.search);
    return (
      !!params.get("vibe_token") ||
      !!params.get("code") ||
      !!params.get("id_token")
    );
  });

  useEffect(() => {
    const handleAuth = async () => {
      const params = new URLSearchParams(window.location.search);

      // Check for vibe_token (passed from parent app via iframe)
      const vibeToken = params.get("vibe_token");
      if (vibeToken) {
        localStorage.setItem("auth_token", vibeToken);
        window.history.replaceState({}, "", "/");
        try {
          const user = await api.auth.getCurrentUser();
          setUser(user);
        } catch (err) {
          console.error("Vibe token auth error:", err);
          localStorage.removeItem("auth_token");
        } finally {
          setIsProcessingCallback(false);
        }
        return;
      }

      // Handle Apple Sign In callback
      const code = params.get("code");
      const idToken = params.get("id_token");

      if (code || idToken) {
        try {
          if (idToken) {
            const user = await api.auth.signInWithApple(idToken, code || "");
            setUser(user);
          }
        } catch (err) {
          console.error("Apple callback error:", err);
        } finally {
          window.history.replaceState({}, "", "/");
          setIsProcessingCallback(false);
        }
      } else {
        setIsProcessingCallback(false);
      }
    };

    handleAuth();
  }, [setUser]);

  if (isProcessingCallback) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-ink">Signing in...</div>
      </div>
    );
  }

  if (DEV_BYPASS_AUTH) {
    return <MapView />;
  }

  return isAuthenticated ? <MapView /> : <AuthScreen />;
}

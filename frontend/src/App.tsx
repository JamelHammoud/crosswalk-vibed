import { useEffect, useState } from "react";
import { useAppStore } from "./stores/app";
import { AuthScreen } from "./components/AuthScreen";
import { MapView } from "./components/MapView";
import { api } from "./services/api";

const DEV_BYPASS_AUTH =
  import.meta.env.DEV && import.meta.env.VITE_DEV_BYPASS_AUTH === "true";

export function App() {
  const { isAuthenticated, setUser } = useAppStore();
  const [isProcessingCallback, setIsProcessingCallback] = useState(false);

  useEffect(() => {
    const handleAppleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const idToken = params.get("id_token");

      if (code || idToken) {
        setIsProcessingCallback(true);
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
      }
    };

    handleAppleCallback();
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

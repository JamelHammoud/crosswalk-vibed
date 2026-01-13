import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { getStoredThemeColor, applyThemeColor } from "../constants/theme";

export function AuthScreen() {
  const { signIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const themeColor = getStoredThemeColor();
    applyThemeColor(themeColor);
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white safe-area-top safe-area-bottom">
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="mb-12 text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-primary flex items-center justify-center shadow-xl">
            <svg
              className="w-12 h-12 text-ink"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M12 2L12 12M12 12L8 8M12 12L16 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="19" r="3" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-ink tracking-tight mb-3">
            Crosswalk
          </h1>
          <p className="text-gray-500 text-lg leading-relaxed max-w-xs mx-auto">
            Leave messages in the world.
            <br />
            Find them when you're close.
          </p>
        </div>

        <div className="w-full max-w-xs space-y-4">
          <button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full h-14 bg-ink text-white font-semibold rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-lg disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
                </svg>
                <span>Continue with Apple</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <p className="mt-6 text-red-500 text-sm text-center">{error}</p>
        )}
      </div>

      <div className="px-8 pb-8 text-center">
        <p className="text-gray-400 text-xs">
          By continuing, you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );
}

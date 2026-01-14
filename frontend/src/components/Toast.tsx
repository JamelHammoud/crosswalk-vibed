import { useEffect } from "react";

interface ToastProps {
  message: string;
  isVisible: boolean;
  onHide: () => void;
  duration?: number;
}

export function Toast({ message, isVisible, onHide, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onHide, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onHide, duration]);

  if (!isVisible) return null;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg max-w-xs">
      <p className="text-sm text-ink font-medium text-center">{message}</p>
    </div>
  );
}
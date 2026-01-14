import { useMemo } from "react";
import type { Drop } from "../types";
import { calculateDistance, PROXIMITY_THRESHOLD } from "../services/distance";
import { useAppStore } from "../stores/app";

interface DropMarkerProps {
  drop: Drop;
  onClick: () => void;
}

export function DropMarker({ drop, onClick }: DropMarkerProps) {
  const currentLocation = useAppStore((s) => s.currentLocation);

  const isNearby = useMemo(() => {
    if (!currentLocation) return false;
    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      drop.latitude,
      drop.longitude
    );
    return distance <= PROXIMITY_THRESHOLD;
  }, [currentLocation, drop.latitude, drop.longitude]);

  return (
    <button
      onClick={onClick}
      className={`
        w-9 h-9 rounded-full bg-gradient-to-br from-ember to-rust
        border-[3px] border-paper shadow-lg
        flex items-center justify-center cursor-pointer
        transition-transform duration-200 ease-out
        hover:scale-110 active:scale-95
        ${isNearby ? "animate-pulse-ring" : ""}
      `}
      style={{
        boxShadow: isNearby
          ? "0 0 20px rgba(255, 107, 53, 0.6), 0 4px 12px rgba(0, 0, 0, 0.3)"
          : "0 4px 12px rgba(0, 0, 0, 0.3)",
      }}
    >
      <div className="w-3 h-3 bg-paper rounded-full" />
    </button>
  );
}

export function UserMarker() {
  return (
    <div className="relative">
      <div className="absolute w-10 h-10 bg-[#007AFF]/20 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse-ring" />
      <div className="w-5 h-5 bg-[#007AFF] border-[3px] border-white rounded-full shadow-lg" />
    </div>
  );
}

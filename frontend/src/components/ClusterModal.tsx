import type { Drop, DropRangeType } from "../types";
import { calculateDistance } from "../services/distance";
import { isWithinDropRange, getRangeLabel } from "../constants/range";
import { useAppStore } from "../stores/app";

interface ClusterModalProps {
  drops: Drop[];
  userLocation: { latitude: number; longitude: number } | null;
  onSelectDrop: (drop: Drop) => void;
  onClose: () => void;
}

export function ClusterModal({
  drops,
  userLocation,
  onSelectDrop,
  onClose,
}: ClusterModalProps) {
  const { themeColor, user } = useAppStore();

  const getDistance = (drop: Drop) => {
    if (!userLocation) return Infinity;
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      drop.latitude,
      drop.longitude
    );
  };

  const checkWithinRange = (drop: Drop) => {
    const distance = getDistance(drop);
    const isOwnDrop = drop.userId === user?.id;
    return isWithinDropRange(drop.range as DropRangeType, distance, isOwnDrop);
  };

  const formatDistance = (meters: number) => {
    if (meters === Infinity) return "Unknown";
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 max-h-[70vh] bg-white rounded-2xl z-50 overflow-hidden animate-scale-in shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-ink">
            {drops.length} Drops Here
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(70vh-60px)] p-2">
          {drops.map((drop) => {
            const withinRange = checkWithinRange(drop);
            const distance = getDistance(drop);

            return (
              <button
                key={drop.id}
                onClick={() => withinRange && onSelectDrop(drop)}
                disabled={!withinRange}
                className={`w-full p-4 rounded-xl mb-2 text-left transition-colors ${
                  withinRange
                    ? "bg-gray-50 hover:bg-gray-100"
                    : "bg-gray-50/50 opacity-60 cursor-not-allowed"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: withinRange ? themeColor : "#d1d5db",
                    }}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        withinRange ? "bg-white/80" : "bg-gray-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p
                        className={`text-sm font-medium ${
                          withinRange ? "text-ink" : "text-gray-500"
                        }`}
                      >
                        {drop.userName || "Anonymous"}
                      </p>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                        {getRangeLabel(drop.range as DropRangeType)}
                      </span>
                    </div>
                    <p
                      className={`text-sm truncate ${
                        withinRange ? "text-gray-600" : "text-gray-400"
                      }`}
                    >
                      {withinRange ? drop.message : "Get closer to read..."}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistance(distance)}
                    </p>
                  </div>
                  {withinRange && (
                    <svg
                      className="w-5 h-5 text-gray-400 flex-shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

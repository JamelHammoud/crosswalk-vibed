import { useMemo, useState, useEffect, useRef } from "react";
import { useAppStore } from "../stores/app";
import { useDrops } from "../hooks/useDrops";
import { api } from "../services/api";
import { calculateDistance } from "../services/distance";
import { isWithinDropRange, DROP_RANGES } from "../constants/range";
import { EmojiExplosion } from "./EmojiExplosion";
import type { DropRangeType, EffectType } from "../types";

const DELETE_WINDOW_MS = 15 * 60 * 1000;

export function MessageDrawer() {
  const {
    user,
    selectedDrop,
    isDrawerOpen,
    currentLocation,
    closeDrawer,
    themeColor,
    updateDropHighfiveCount,
  } = useAppStore();
  const { deleteDrop } = useDrops();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEffect, setShowEffect] = useState(false);
  const lastDropIdRef = useRef<string | null>(null);
  const [hasHighfived, setHasHighfived] = useState(false);
  const [isHighfiving, setIsHighfiving] = useState(false);
  const [localHighfiveCount, setLocalHighfiveCount] = useState(0);

  useEffect(() => {
    if (selectedDrop) {
      setLocalHighfiveCount(selectedDrop.highfiveCount || 0);
      checkHighfiveStatus(selectedDrop.id);
    }
  }, [selectedDrop?.id]);

  const checkHighfiveStatus = async (dropId: string) => {
    try {
      const result = await api.drops.hasHighfived(dropId);
      setHasHighfived(result.hasHighfived);
    } catch (err) {
      console.error("Failed to check highfive status:", err);
    }
  };

  const distance = useMemo(() => {
    if (!selectedDrop || !currentLocation) return null;
    return calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      selectedDrop.latitude,
      selectedDrop.longitude
    );
  }, [selectedDrop, currentLocation]);

  const dropRange = (selectedDrop?.range || "close") as DropRangeType;
  const dropEffect = (selectedDrop?.effect || "none") as EffectType;
  const isOwnDrop = selectedDrop?.userId === user?.id;
  const isNearby =
    distance !== null && isWithinDropRange(dropRange, distance, isOwnDrop);
  const rangeMeters = DROP_RANGES[dropRange].meters;

  const canDelete = useMemo(() => {
    if (!selectedDrop || !user) return false;
    if (selectedDrop.userId !== user.id) return false;
    const createdAt = new Date(selectedDrop.createdAt).getTime();
    return Date.now() - createdAt < DELETE_WINDOW_MS;
  }, [selectedDrop, user]);

  useEffect(() => {
    if (
      isDrawerOpen &&
      selectedDrop &&
      isNearby &&
      dropEffect !== "none" &&
      lastDropIdRef.current !== selectedDrop.id
    ) {
      lastDropIdRef.current = selectedDrop.id;
      setShowEffect(true);
    }
  }, [isDrawerOpen, selectedDrop, isNearby, dropEffect]);

  useEffect(() => {
    if (!isDrawerOpen) {
      lastDropIdRef.current = null;
      setShowEffect(false);
    }
  }, [isDrawerOpen]);

  if (!isDrawerOpen || !selectedDrop) return null;

  const timeAgo = getTimeAgo(new Date(selectedDrop.createdAt));

  const handleDelete = async () => {
    if (!canDelete || isDeleting) return;
    setIsDeleting(true);
    const success = await deleteDrop(selectedDrop.id);
    setIsDeleting(false);
    if (success) {
      closeDrawer();
    }
  };

  const handleHighfive = async () => {
    if (isHighfiving || isOwnDrop) return;
    setIsHighfiving(true);

    try {
      if (hasHighfived) {
        const result = await api.drops.unhighfive(selectedDrop.id);
        setHasHighfived(false);
        setLocalHighfiveCount(result.highfiveCount);
        updateDropHighfiveCount(selectedDrop.id, result.highfiveCount);
      } else {
        const result = await api.drops.highfive(selectedDrop.id);
        setHasHighfived(true);
        setLocalHighfiveCount(result.highfiveCount);
        updateDropHighfiveCount(selectedDrop.id, result.highfiveCount);
      }
    } catch (err) {
      console.error("Failed to highfive:", err);
    } finally {
      setIsHighfiving(false);
    }
  };

  return (
    <>
      {showEffect && (
        <EmojiExplosion
          effect={dropEffect}
          onComplete={() => setShowEffect(false)}
        />
      )}

      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={closeDrawer}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 animate-slide-up">
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3" />
        <div className="p-6 safe-area-bottom">
          {isNearby ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: themeColor }}
                >
                  <span className="text-ink font-semibold text-sm">
                    {(selectedDrop.userName || "A")[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-ink font-medium">
                    {selectedDrop.userName || "Anonymous"}
                  </p>
                  <p className="text-gray-500 text-sm">{timeAgo}</p>
                </div>
                {canDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-red-50 text-red-600 text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    {isDeleting ? "..." : "Delete"}
                  </button>
                )}
              </div>
              <p className="text-ink text-lg leading-relaxed">
                {selectedDrop.message}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  onClick={handleHighfive}
                  disabled={isHighfiving || isOwnDrop}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all ${
                    hasHighfived
                      ? "bg-primary/20 text-ink"
                      : "bg-gray-100 text-ink/70 hover:bg-gray-200"
                  } ${isOwnDrop ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={
                    hasHighfived ? { backgroundColor: `${themeColor}33` } : {}
                  }
                >
                  <span className="text-lg">🙌</span>
                  <span>
                    {localHighfiveCount > 0 ? localHighfiveCount : "High-five"}
                  </span>
                </button>

                <span className="text-sm text-gray-400">
                  {distance !== null && `${Math.round(distance)}m away`}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h3 className="text-ink font-semibold text-lg mb-2">
                Too Far Away
              </h3>
              <p className="text-gray-500">
                You need to be within{" "}
                {rangeMeters === Infinity ? "range" : `${rangeMeters} meters`}{" "}
                to read this drop.
              </p>
              <p className="font-medium mt-2" style={{ color: themeColor }}>
                {Math.round(distance || 0)}m away
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

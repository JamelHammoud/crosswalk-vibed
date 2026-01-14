import { useCallback, useEffect } from "react";
import { useAppStore } from "../stores/app";
import { api } from "../services/api";
import { wsService, pusherService } from "../services/pusher";
import type { DropRangeType, EffectType } from "../types";

export function useDrops() {
  const {
    drops,
    currentLocation,
    user,
    setDrops,
    addDrop,
    removeDrop,
    setLoading,
    setError,
  } = useAppStore();

  useEffect(() => {
    wsService.connect(user?.id);

    const unsubscribeNew = wsService.onNewDrop((drop) => {
      addDrop(drop);
    });

    const unsubscribeDelete = wsService.onDeleteDrop((dropId) => {
      removeDrop(dropId);
    });

    return () => {
      unsubscribeNew();
      unsubscribeDelete();
    };
  }, [addDrop, removeDrop, user?.id]);

  // Subscribe to user channel when user changes
  useEffect(() => {
    if (user?.id) {
      pusherService.subscribeToUserChannel(user.id);
    }
  }, [user?.id]);

  const fetchDrops = useCallback(async () => {
    if (!currentLocation) return;

    setLoading(true);
    try {
      const result = await api.drops.getAll(
        currentLocation.latitude,
        currentLocation.longitude,
        999999999
      );
      setDrops(result);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load drops";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [currentLocation, setDrops, setLoading, setError]);

  const createDrop = useCallback(
    async (
      message: string,
      range: DropRangeType = "close",
      effect: EffectType = "none",
      expiresAt: string | null = null
    ) => {
      if (!currentLocation) {
        setError("Location required to create a drop");
        return null;
      }

      setLoading(true);
      try {
        const drop = await api.drops.create(
          message,
          currentLocation.latitude,
          currentLocation.longitude,
          range,
          effect,
          expiresAt
        );
        return drop;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create drop";
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [currentLocation, setLoading, setError]
  );

  const deleteDrop = useCallback(
    async (dropId: string) => {
      try {
        await api.drops.delete(dropId);
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete drop";
        setError(errorMessage);
        return false;
      }
    },
    [setError]
  );

  return {
    drops,
    fetchDrops,
    createDrop,
    deleteDrop,
  };
}

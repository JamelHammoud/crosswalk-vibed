import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAppStore } from "../stores/app";
import { useLocation } from "../hooks/useLocation";
import { useDrops } from "../hooks/useDrops";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { MessageDrawer } from "./MessageDrawer";
import { DropComposer } from "./DropComposer";
import { ProfileDrawer } from "./ProfileDrawer";
import { ClusterModal } from "./ClusterModal";
import { ActivityView } from "./ActivityView";
import { calculateDistance } from "../services/distance";
import { isWithinDropRange } from "../constants/range";
import type { Drop } from "../types";
import type { DropRangeType } from "../types";

const MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "carto-tiles": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [
    {
      id: "carto-tiles-layer",
      type: "raster",
      source: "carto-tiles",
      minzoom: 0,
      maxzoom: 20,
    },
  ],
};

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const dropMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const dropsRef = useRef<Drop[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [clusterDrops, setClusterDrops] = useState<Drop[] | null>(null);
  const [showRecenterButton, setShowRecenterButton] = useState(false);

  const {
    user,
    currentLocation,
    drops,
    selectDrop,
    isComposerOpen,
    openComposer,
    themeColor,
    activeTab,
    setActiveTab,
    unreadCount,
    setUnreadCount,
    focusDropId,
    setFocusDropId,
  } = useAppStore();
  const { getCurrentPosition, startWatching } = useLocation();
  const { fetchDrops } = useDrops();
  const { signOut } = useAuth();

  useEffect(() => {
    dropsRef.current = drops;
  }, [drops]);

  useEffect(() => {
    loadUnreadCount();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const result = await api.notifications.getUnreadCount();
      setUnreadCount(result.count);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  };

  useEffect(() => {
    if (focusDropId && activeTab === "map" && mapRef.current) {
      const drop = drops.find((d) => d.id === focusDropId);
      if (drop) {
        mapRef.current.flyTo({
          center: [drop.longitude, drop.latitude],
          zoom: 17,
          duration: 1000,
        });
        setTimeout(() => {
          selectDrop(drop);
          setFocusDropId(null);
        }, 1000);
      } else {
        api.drops.getById(focusDropId).then((drop) => {
          if (drop && mapRef.current) {
            mapRef.current.flyTo({
              center: [drop.longitude, drop.latitude],
              zoom: 17,
              duration: 1000,
            });
            setTimeout(() => {
              selectDrop(drop);
              setFocusDropId(null);
            }, 1000);
          }
        });
      }
    }
  }, [focusDropId, activeTab, drops]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const initialCenter = currentLocation
      ? [currentLocation.longitude, currentLocation.latitude]
      : [-122.4194, 37.7749];

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: initialCenter as [number, number],
      zoom: 15,
      maxZoom: 19,
      minZoom: 2,
      fadeDuration: 0,
    });

    mapRef.current = map;

    map.on("load", async () => {
      map.addSource("drops", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
        cluster: true,
        clusterMaxZoom: 19,
        clusterRadius: 40,
      });

      map.addLayer({
        id: "cluster-circles",
        type: "circle",
        source: "drops",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1a1a1a",
          "circle-radius": 24,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#e5e5e5",
          "circle-color-transition": { duration: 0 },
          "circle-radius-transition": { duration: 0 },
          "circle-stroke-width-transition": { duration: 0 },
          "circle-stroke-color-transition": { duration: 0 },
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "drops",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 14,
          "text-allow-overlap": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-color-transition": { duration: 0 },
          "text-opacity-transition": { duration: 0 },
        },
      });

      map.on("click", "cluster-circles", async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["cluster-circles"],
        });
        if (!features.length) return;

        const clusterId = features[0].properties?.cluster_id;
        const source = map.getSource("drops") as maplibregl.GeoJSONSource;

        try {
          const leaves = await source.getClusterLeaves(clusterId, 100, 0);
          const clusterDropIds = leaves.map(
            (f: any) => f.properties.id
          ) as string[];
          const clusterDropsData = dropsRef.current.filter((d) =>
            clusterDropIds.includes(d.id)
          );
          setClusterDrops(clusterDropsData);
        } catch (err) {
          console.error("Error getting cluster leaves:", err);
        }
      });

      map.on("mouseenter", "cluster-circles", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "cluster-circles", () => {
        map.getCanvas().style.cursor = "";
      });

      if (!currentLocation) {
        await getCurrentPosition();
      }
      startWatching();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !currentLocation) return;

    const { latitude, longitude } = currentLocation;

    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.innerHTML = `
        <div class="relative">
          <div class="absolute w-10 h-10 bg-[#007AFF]/20 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style="animation: pulse-ring 2s ease-out infinite;"></div>
          <div class="w-5 h-5 bg-[#007AFF] border-[3px] border-white rounded-full" style="box-shadow: 0 2px 8px rgba(0, 122, 255, 0.4);"></div>
        </div>
      `;
      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([longitude, latitude])
        .addTo(mapRef.current);

      mapRef.current.flyTo({
        center: [longitude, latitude],
        zoom: 17,
        duration: 1000,
      });
    } else {
      userMarkerRef.current.setLngLat([longitude, latitude]);
    }

    fetchDrops();
  }, [currentLocation, fetchDrops]);

  useEffect(() => {
    if (!mapRef.current) return;

    const source = mapRef.current.getSource(
      "drops"
    ) as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = drops.map((drop) => {
      const isOwnDrop = drop.userId === user?.id;
      return {
        type: "Feature" as const,
        properties: {
          id: drop.id,
          userId: drop.userId,
          message: drop.message,
          userName: drop.userName,
          createdAt: drop.createdAt,
          isWithinRange: currentLocation
            ? isWithinDropRange(
                drop.range as DropRangeType,
                calculateDistance(
                  currentLocation.latitude,
                  currentLocation.longitude,
                  drop.latitude,
                  drop.longitude
                ),
                isOwnDrop
              )
            : isOwnDrop,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [drop.longitude, drop.latitude],
        },
      };
    });

    source.setData({
      type: "FeatureCollection",
      features,
    });

    dropMarkersRef.current.forEach((marker) => marker.remove());
    dropMarkersRef.current.clear();

    drops.forEach((drop) => {
      const distance = currentLocation
        ? calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            drop.latitude,
            drop.longitude
          )
        : Infinity;
      const isOwnDrop = drop.userId === user?.id;
      const withinRange = isWithinDropRange(
        drop.range as DropRangeType,
        distance,
        isOwnDrop
      );

      const el = createDropMarkerElement(
        drop,
        () => selectDrop(drop),
        withinRange,
        themeColor
      );
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([drop.longitude, drop.latitude])
        .addTo(mapRef.current!);
      dropMarkersRef.current.set(drop.id, marker);
    });
  }, [drops, selectDrop, currentLocation, themeColor]);

  useEffect(() => {
    if (!mapRef.current || drops.length === 0) return;

    const updateMarkerVisibility = () => {
      if (!mapRef.current) return;

      const unclusteredFeatures = mapRef.current.querySourceFeatures("drops", {
        filter: ["!", ["has", "point_count"]],
      });

      const unclusteredIds = new Set(
        unclusteredFeatures.map((f) => f.properties?.id)
      );

      dropMarkersRef.current.forEach((marker, id) => {
        const el = marker.getElement();
        const isUnclustered = unclusteredIds.has(id);
        el.style.display = isUnclustered ? "flex" : "none";
      });
    };

    mapRef.current.on("moveend", updateMarkerVisibility);
    mapRef.current.on("zoomend", updateMarkerVisibility);

    const timeoutId = setTimeout(updateMarkerVisibility, 100);

    return () => {
      clearTimeout(timeoutId);
      mapRef.current?.off("moveend", updateMarkerVisibility);
      mapRef.current?.off("zoomend", updateMarkerVisibility);
    };
  }, [drops]);

  useEffect(() => {
    if (!mapRef.current || !currentLocation) return;

    const checkRecenterVisibility = () => {
      if (!mapRef.current || !currentLocation) {
        setShowRecenterButton(false);
        return;
      }

      const bounds = mapRef.current.getBounds();
      const zoom = mapRef.current.getZoom();
      const userLng = currentLocation.longitude;
      const userLat = currentLocation.latitude;

      const isInBounds =
        userLng >= bounds.getWest() &&
        userLng <= bounds.getEast() &&
        userLat >= bounds.getSouth() &&
        userLat <= bounds.getNorth();

      const isZoomedOut = zoom < 14;

      setShowRecenterButton(!isInBounds || isZoomedOut);
    };

    mapRef.current.on("moveend", checkRecenterVisibility);
    mapRef.current.on("zoomend", checkRecenterVisibility);
    checkRecenterVisibility();

    return () => {
      mapRef.current?.off("moveend", checkRecenterVisibility);
      mapRef.current?.off("zoomend", checkRecenterVisibility);
    };
  }, [currentLocation]);

  const handleRecenter = useCallback(() => {
    if (!mapRef.current || !currentLocation) return;
    mapRef.current.flyTo({
      center: [currentLocation.longitude, currentLocation.latitude],
      zoom: 17,
      duration: 500,
    });
  }, [currentLocation]);

  const handleOpenProfile = () => {
    setIsProfileOpen(true);
  };

  const handleClusterDropSelect = (drop: Drop) => {
    setClusterDrops(null);
    selectDrop(drop);
  };

  return (
    <div
      className="h-full w-full relative bg-paper"
      style={{ minHeight: "100dvh" }}
    >
      <div
        className="absolute inset-0"
        style={{ display: activeTab === "map" ? "block" : "none" }}
      >
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {showRecenterButton && (
          <button
            onClick={handleRecenter}
            className="absolute bottom-24 right-4 w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center border border-gray-200 shadow-lg z-10"
          >
            <svg
              className="w-6 h-6 text-ink"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
            </svg>
          </button>
        )}
      </div>

      {activeTab === "activity" && <ActivityView />}

      <div
        className="safe-area-bottom absolute bottom-0 left-0 right-0 z-20"
        style={{
          background:
            "linear-gradient(to top, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.8) 70%, rgba(255,255,255,0) 100%)",
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("map")}
            className="relative w-12 h-12 flex items-center justify-center"
          >
            <svg
              className={`w-8 h-8 ${
                activeTab === "map" ? "text-ink" : "text-ink/30"
              }`}
              viewBox="0 0 32 32"
              fill="currentColor"
            >
              <path d="M24.4854 6.18173C26.6885 8.38458 27.9485 11.3579 27.999 14.473C28.0496 17.588 26.8866 20.6006 24.7561 22.8737L24.4854 23.1537L18.8281 28.8097C18.1102 29.5271 17.1466 29.9448 16.1323 29.9782C15.118 30.0117 14.1289 29.6583 13.3654 28.9897L13.1734 28.8097L7.51474 23.1524C5.26429 20.902 4 17.8497 4 14.6671C4 11.4844 5.26429 8.43218 7.51474 6.18173C9.76519 3.93128 12.8175 2.66699 16.0001 2.66699C19.1827 2.66699 22.235 3.93128 24.4854 6.18173ZM16.0001 10.6671C15.4748 10.6671 14.9546 10.7705 14.4693 10.9715C13.984 11.1726 13.5431 11.4672 13.1716 11.8386C12.8002 12.2101 12.5056 12.651 12.3046 13.1363C12.1035 13.6216 12.0001 14.1418 12.0001 14.6671C12.0001 15.1924 12.1035 15.7125 12.3046 16.1978C12.5056 16.6831 12.8002 17.1241 13.1716 17.4955C13.5431 17.8669 13.984 18.1616 14.4693 18.3626C14.9546 18.5636 15.4748 18.6671 16.0001 18.6671C17.0609 18.6671 18.0784 18.2456 18.8285 17.4955C19.5786 16.7453 20.0001 15.7279 20.0001 14.6671C20.0001 13.6062 19.5786 12.5888 18.8285 11.8386C18.0784 11.0885 17.0609 10.6671 16.0001 10.6671Z" />
            </svg>
            <div
              className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1B1919] transition-opacity ${
                activeTab === "map" ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>

          <button className="w-12 h-12 flex items-center justify-center text-ink/30">
            <svg className="w-8 h-8" viewBox="0 0 32 32" fill="currentColor">
              <path d="M10.4658 6.00042C10.176 6.00042 9.86667 6.02939 9.56623 6.10365C9.26045 6.1779 8.53156 6.40246 8.07645 7.12144L8.05156 7.15766L6.97245 9.05922C6.42668 9.43048 6.02312 9.89229 5.74045 10.3577L5.71557 10.3939L1.14312 18.8152C0.960257 19.1013 0.797481 19.4003 0.656011 19.7098L0.645344 19.7279C0.218366 20.678 -0.00178036 21.711 1.08433e-05 22.7559C1.08433e-05 24.6772 0.749214 26.5197 2.08281 27.8783C3.4164 29.2368 5.22514 30 7.11112 30C8.9971 30 10.8058 29.2368 12.1394 27.8783C13.473 26.5197 14.2222 24.6772 14.2222 22.7559V20.9449H17.7778V22.7559C17.778 23.8386 18.0163 24.9074 18.4754 25.8839C18.9345 26.8603 19.6025 27.7195 20.4305 28.3983C21.2584 29.077 22.2252 29.5581 23.2597 29.8062C24.2942 30.0542 25.3701 30.0629 26.4084 29.8315C27.4466 29.6002 28.4207 29.1347 29.2591 28.4694C30.0975 27.804 30.7788 26.9557 31.253 25.9868C31.7272 25.0179 31.9821 23.953 31.9991 22.8705C32.0161 21.788 31.7946 20.7154 31.3511 19.7315L31.344 19.7098C31.2025 19.4003 31.0398 19.1013 30.8569 18.8152L26.2844 10.3939L26.2596 10.3577C25.9468 9.83898 25.5263 9.39636 25.0276 9.06103L23.9484 7.15766L23.9236 7.12144C23.4684 6.40246 22.7378 6.17971 22.4338 6.10365C22.0472 6.01202 21.6491 5.98087 21.2533 6.01128C20.8372 6.03258 20.428 6.12821 20.0444 6.2938C19.7173 6.44049 18.9102 6.886 18.704 7.9038L18.6916 7.9708L18.4427 9.96292C18.0516 10.4754 17.7778 11.122 17.7778 11.8898V13.7009H14.2222V11.8898C14.2222 11.122 13.9485 10.4754 13.5591 9.96292L13.3102 7.9708L13.296 7.9038C13.0898 6.886 12.2827 6.44049 11.9556 6.2938C11.572 6.12821 11.1628 6.03258 10.7467 6.01128C10.6532 6.00389 10.5595 6.00027 10.4658 6.00042ZM7.11112 19.1339C7.87594 19.1343 8.62025 19.386 9.23356 19.8515C9.84687 20.317 10.2965 20.9715 10.5157 21.718C10.7348 22.4644 10.7119 23.263 10.4502 23.9951C10.1886 24.7272 9.70216 25.3538 9.06317 25.782C8.42419 26.2102 7.66671 26.417 6.90317 26.3719C6.13963 26.3267 5.41074 26.032 4.82468 25.5314C4.23862 25.0308 3.82665 24.351 3.64991 23.5929C3.47316 22.8349 3.54108 22.039 3.84357 21.3234L4.18134 20.7041C4.82134 19.7569 5.89512 19.1339 7.11112 19.1339ZM24.8889 19.1339C26.1049 19.1339 27.1787 19.7569 27.8187 20.7041L28.1564 21.3234C28.4589 22.039 28.5268 22.8349 28.3501 23.5929C28.1734 24.351 27.7614 25.0308 27.1753 25.5314C26.5893 26.032 25.8604 26.3267 25.0968 26.3719C24.3333 26.417 23.5758 26.2102 22.9368 25.782C22.2979 25.3538 21.8114 24.7272 21.5498 23.9951C21.2881 23.263 21.2652 22.4644 21.4844 21.718C21.7035 20.9715 22.1531 20.317 22.7665 19.8515C23.3798 19.386 24.1241 19.1343 24.8889 19.1339Z" />
            </svg>
          </button>

          <button
            onClick={openComposer}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg"
          >
            <svg
              className="w-6 h-6 text-ink"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 4.5V19.5M19.5 12H4.5" />
            </svg>
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className="relative w-12 h-12 flex items-center justify-center"
          >
            <svg
              className={`w-8 h-8 ${
                activeTab === "activity" ? "text-ink" : "text-ink/30"
              }`}
              viewBox="0 0 32 32"
              fill="currentColor"
            >
              <path d="M19.2277 26.5C20.4769 26.5 21.1368 28.036 20.3036 29.002C19.7618 29.6306 19.0985 30.1334 18.3569 30.4777C17.6154 30.822 16.8123 31 16 31C15.1878 31 14.3847 30.822 13.6431 30.4777C12.9016 30.1334 12.2383 29.6306 11.6965 29.002C10.8993 28.078 11.4683 26.6335 12.6121 26.5105L12.7709 26.5015L19.2277 26.5ZM16 1C17.9612 1 19.619 2.3545 20.1519 4.2115L20.2184 4.468L20.2299 4.5325C21.8221 5.46507 23.1789 6.7763 24.1891 8.3587C25.1992 9.94109 25.8339 11.7496 26.0411 13.636L26.0816 14.0665L26.109 14.5V18.8965L26.1393 19.1005C26.3371 20.2057 26.9259 21.1941 27.79 21.871L28.0312 22.0465L28.2651 22.195C29.5071 22.9255 29.0738 24.844 27.7207 24.991L27.5532 25H4.44689C2.96231 25 2.44386 22.954 3.73492 22.195C4.28519 21.8716 4.76062 21.4269 5.12786 20.8924C5.49509 20.3578 5.74523 19.7462 5.8607 19.1005L5.89103 18.886L5.89247 14.431C5.98053 12.4718 6.52957 10.5649 7.49155 8.8772C8.45353 7.18949 9.79912 5.77241 11.4105 4.75L11.7687 4.531L11.7831 4.4665C11.9868 3.56924 12.4509 2.75862 13.1127 2.14427C13.7744 1.52992 14.6018 1.14148 15.483 1.0315L15.7459 1.006L16 1Z" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
            <div
              className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#1B1919] transition-opacity ${
                activeTab === "activity" ? "opacity-100" : "opacity-0"
              }`}
            />
          </button>

          <button
            onClick={handleOpenProfile}
            className="w-10 h-10 rounded-full bg-ink/10 overflow-hidden flex items-center justify-center"
          >
            <svg
              className="w-5 h-5 text-ink/30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
          </button>
        </div>
      </div>

      <MessageDrawer />
      {isComposerOpen && <DropComposer />}
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onSignOut={signOut}
      />
      {clusterDrops && (
        <ClusterModal
          drops={clusterDrops}
          userLocation={currentLocation}
          onSelectDrop={handleClusterDropSelect}
          onClose={() => setClusterDrops(null)}
        />
      )}
    </div>
  );
}

function createDropMarkerElement(
  _drop: Drop,
  onClick: () => void,
  isWithinRange: boolean,
  themeColor: string
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;";

  const el = document.createElement("button");

  if (isWithinRange) {
    el.className = `
      w-7 h-7 rounded-full
      border-[2.5px] border-white
      cursor-pointer
      transition-all duration-200 ease-out
    `;
    el.style.cssText = `
      background-color: ${themeColor};
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
      transform-origin: center center;
    `;

    el.onmouseenter = () => {
      el.style.boxShadow = `0 5px 16px ${themeColor}80`;
    };
    el.onmouseleave = () => {
      el.style.boxShadow = "0 3px 10px rgba(0, 0, 0, 0.15)";
    };
  } else {
    el.className = `
      w-7 h-7 rounded-full
      border-[2.5px] border-white
      cursor-pointer
      transition-all duration-200 ease-out
    `;
    el.style.cssText = `
      background-color: #E5E2E1;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
      transform-origin: center center;
    `;

    el.onmouseenter = () => {
      el.style.boxShadow = "0 5px 14px rgba(100, 100, 100, 0.25)";
    };
    el.onmouseleave = () => {
      el.style.boxShadow = "0 3px 10px rgba(0, 0, 0, 0.1)";
    };
  }

  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });

  wrapper.appendChild(el);
  return wrapper;
}

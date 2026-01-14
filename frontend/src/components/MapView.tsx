import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLocationStore } from '../stores/locationStore';
import { useMessageStore } from '../stores/messageStore';
import { toast } from 'react-hot-toast';

const MapView: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  const { userLocation, requestLocation } = useLocationStore();
  const { messages, fetchNearbyMessages } = useMessageStore();

  const compliments = [
    "You're absolutely amazing! ✨",
    "Your smile could light up the whole world! 😊",
    "You have incredible style! 🌟",
    "You're one in a million! 💎",
    "Your positive energy is contagious! ⚡",
    "You make everything better just by being you! 🌈",
    "You're a true inspiration! 🚀",
    "Your kindness makes the world brighter! ☀️",
    "You have such a beautiful soul! 💖",
    "You're absolutely fantastic! 🎉"
  ];

  const showRandomCompliment = () => {
    const randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
    toast.success(randomCompliment, {
      duration: 4000,
      style: {
        background: '#10B981',
        color: 'white',
        fontSize: '16px',
        fontWeight: '500'
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#10B981'
      }
    });
  };

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=demo',
      center: [-74.006, 40.7128], // NYC default
      zoom: 13
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Request user location on mount
    requestLocation();

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [requestLocation]);

  useEffect(() => {
    if (mapLoaded && userLocation && map.current) {
      // Center map on user location
      map.current.setCenter([userLocation.longitude, userLocation.latitude]);
      
      // Add user location marker
      new maplibregl.Marker({ color: '#3B82F6' })
        .setLngLat([userLocation.longitude, userLocation.latitude])
        .addTo(map.current);

      // Fetch nearby messages
      fetchNearbyMessages(userLocation.latitude, userLocation.longitude);
    }
  }, [mapLoaded, userLocation, fetchNearbyMessages]);

  useEffect(() => {
    if (mapLoaded && map.current && messages.length > 0) {
      // Add message markers
      messages.forEach(message => {
        const popup = new maplibregl.Popup()
          .setHTML(`
            <div class="p-2">
              <p class="font-medium">${message.content}</p>
              <p class="text-sm text-gray-500 mt-1">${new Date(message.created_at).toLocaleDateString()}</p>
            </div>
          `);

        new maplibregl.Marker({ color: '#10B981' })
          .setLngLat([message.longitude, message.latitude])
          .setPopup(popup)
          .addTo(map.current!);
      });
    }
  }, [mapLoaded, messages]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Floating Action Button */}
      <button
        onClick={showRandomCompliment}
        className="absolute bottom-6 right-6 w-14 h-14 bg-yellow-400 hover:bg-yellow-500 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all duration-200 hover:scale-110 active:scale-95 z-10"
        aria-label="Get a compliment"
      >
        😊
      </button>
    </div>
  );
};

export default MapView;
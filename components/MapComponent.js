'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapComponent({ latitude, longitude, onChangeLocation }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Initialize Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Fix default Leaflet marker icon asset resolution issues in bundle
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const startLat = latitude || 10.7769; // HCMC coordinate
    const startLon = longitude || 106.7009;

    const map = L.map(mapContainerRef.current).setView([startLat, startLon], 14);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([startLat, startLon], {
      draggable: true,
    }).addTo(map);
    markerRef.current = marker;

    // Update coordinates on dragend
    marker.on('dragend', () => {
      const position = marker.getLatLng();
      onChangeLocation(position.lat, position.lng);
    });

    // Update coordinates on map click
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      onChangeLocation(lat, lng);
    });

    return () => {
      map.remove();
    };
  }, []);

  // Sync marker position when coords update from search autocomplete
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !latitude || !longitude) return;
    const currentMarkerLatLng = markerRef.current.getLatLng();
    if (currentMarkerLatLng.lat !== latitude || currentMarkerLatLng.lng !== longitude) {
      const latLng = [latitude, longitude];
      markerRef.current.setLatLng(latLng);
      mapRef.current.setView(latLng, 14);
    }
  }, [latitude, longitude]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ height: '300px', width: '100%', borderRadius: '16px', zIndex: 10 }}
      className="border border-gray-200 shadow-inner"
    />
  );
}

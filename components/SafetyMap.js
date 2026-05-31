'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function SafetyMap({ zones = [], mode = 'view', selectedCoords = null, onChangeCoords = null }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const selectionMarkerRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    // Fix default Leaflet marker icon asset resolution issues
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });

    const startLat = selectedCoords?.lat || 10.7769; // HCMC coordinate
    const startLng = selectedCoords?.lng || 106.7009;

    const map = L.map(mapContainerRef.current).setView([startLat, startLng], 12);
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // MODE: SELECT COORDS
    if (mode === 'select') {
      const marker = L.marker([startLat, startLng], {
        draggable: true,
      }).addTo(map);
      selectionMarkerRef.current = marker;

      marker.on('dragend', () => {
        const position = marker.getLatLng();
        if (onChangeCoords) onChangeCoords(position.lat, position.lng);
      });

      map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        if (onChangeCoords) onChangeCoords(lat, lng);
      });
    }

    return () => {
      map.remove();
    };
  }, [mode]);

  // MODE: VIEW WARN ZONES (Update markers when zones change)
  useEffect(() => {
    if (mode !== 'view' || !mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    zones.forEach(z => {
      // Check if coordinates exist. If not, generate slight offset from HCMC center
      let lat = z.latitude;
      let lng = z.longitude;

      if (!lat || !lng) {
        // Fallback to random coordinate around HCMC center for demo purposes
        const offsetLat = (Math.random() - 0.5) * 0.12;
        const offsetLng = (Math.random() - 0.5) * 0.12;
        lat = 10.7769 + offsetLat;
        lng = 106.7009 + offsetLng;
      }

      const warningType = z.warningType || 'scam';
      const label = warningType === 'scam' ? '🚫 Lừa đảo' : warningType === 'theft' ? '🔒 Trộm cắp' : '⚠️ Nguy hiểm';

      // Create a custom pulsing HTML icon
      const customIcon = L.divIcon({
        className: 'pulsing-marker-wrapper',
        html: `<div class="pulsing-marker pulsing-marker-${warningType}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const popupHtml = `
        <div style="font-family: inherit; font-size: 12px; padding: 2px;">
          <h4 style="margin: 0 0 6px 0; font-weight: 800; font-size: 13px; color: #1e293b;">
            ${label}
          </h4>
          <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">📍 ${z.address || 'Chưa rõ địa chỉ'}</p>
          <p style="margin: 0 0 6px 0; color: #64748b; line-height: 1.3;">${z.description || ''}</p>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 4px; margin-top: 6px; font-size: 10px; color: #94a3b8;">
            <span>Bởi: ${z.reporterName || 'Ẩn danh'}</span>
            <span style="font-weight: 700; color: #ef4444;">👍 ${z.upvotes || 0} lượt xác nhận</span>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(mapRef.current)
        .bindPopup(popupHtml);

      markersRef.current.push(marker);
    });

    // Fit map bounds to show all markers if there are any
    if (markersRef.current.length > 0 && mapRef.current) {
      const group = new L.featureGroup(markersRef.current);
      mapRef.current.fitBounds(group.getBounds().pad(0.1));
    }
  }, [zones, mode]);

  return (
    <div 
      ref={mapContainerRef} 
      className={mode === 'select' ? 'safety-mini-map' : 'safety-map-container'}
    />
  );
}

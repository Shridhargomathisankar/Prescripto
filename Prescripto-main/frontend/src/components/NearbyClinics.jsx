import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

/* =========================
   Leaflet marker fix
========================= */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* =========================
   Recenter button helper
========================= */
function RecenterMap({ center }) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => map.setView(center, 14)}
      className="absolute top-3 right-3 z-[1000] bg-white rounded-full shadow p-2 hover:bg-slate-100"
      title="Go to my location"
    >
      📍
    </button>
  );
}

/* =========================
   Nearby Clinics (OSM)
========================= */
export default function NearbyClinics({ onBack, t }) {
  const [center, setCenter] = useState(null); // user location
  const [places, setPlaces] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* =========================
     Get user location (ONLY once)
  ========================= */
  useEffect(() => {
    if (!navigator.geolocation) {
      setCenter([13.0827, 80.2707]); // Chennai fallback
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {
        setCenter([13.0827, 80.2707]);
      }
    );
  }, []);

  /* =========================
     SEARCH (only on button click)
  ========================= */
  const searchPlaces = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setPlaces([]);

    const [lat, lon] = center;
    const keyword = query.trim().toLowerCase();

    const overpassQuery = `
      [out:json];
      (
        node["amenity"~"hospital|clinic|doctors|pharmacy"](around:5000,${lat},${lon});
        node["healthcare"~".*"](around:5000,${lat},${lon});
        node["name"~"${keyword}", i](around:5000,${lat},${lon});
      );
      out tags center;
    `;

    try {
      const res = await fetch(
        'https://overpass-api.de/api/interpreter',
        {
          method: 'POST',
          body: overpassQuery,
        }
      );

      const data = await res.json();

      const results = (data.elements || [])
        .map((el) => ({
          id: el.id,
          name: el.tags?.name || 'Unnamed Place',
          lat: el.lat || el.center?.lat,
          lon: el.lon || el.center?.lon,
          address:
            el.tags?.['addr:full'] ||
            el.tags?.['addr:street'] ||
            '',
        }))
        .filter((p) => p.lat && p.lon);

      setPlaces(results);
    } catch {
      setError('Failed to search nearby places');
    } finally {
      setLoading(false);
    }
  };

  if (!center) {
    return (
      <p className="text-sm text-slate-500">
        Getting your location…
      </p>
    );
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm border p-4 space-y-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-teal-800">
          {t?.('findNearbyClinics') || 'Find nearby clinics'}
        </h2>
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-sky-600 hover:underline"
        >
          {t?.('backToDashboard') || 'Back to dashboard'}
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="hospital, dentist, dermatologist..."
          className="flex-1 px-3 py-2.5 rounded-xl border bg-slate-50 focus:bg-white focus:border-teal-500 outline-none text-sm"
        />
        <button
          onClick={searchPlaces}
          className="px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium"
        >
          {t?.('search') || 'Search'}
        </button>
      </div>

      {/* Map */}
      <MapContainer
        center={center}
        zoom={14}
        className="w-full h-56 rounded-xl"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap contributors"
        />

        {/* Recenter icon */}
        <RecenterMap center={center} />

        {/* User location */}
        <Marker position={center}>
          <Popup>You are here</Popup>
        </Marker>

        {/* Search results */}
        {places.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lon]}>
            <Popup>
              <strong>{p.name}</strong>
              {p.address && (
                <div className="text-xs mt-1">{p.address}</div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Status */}
      {loading && (
        <p className="text-sm text-slate-500">
          Searching nearby places…
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Results list */}
      {places.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-700">
            Results
          </h3>
          <ul className="space-y-2 max-h-60 overflow-y-auto">
            {places.map((p) => (
              <li
                key={p.id}
                className="p-3 rounded-xl bg-slate-50 border"
              >
                <p className="font-medium text-slate-800">
                  {p.name}
                </p>
                {p.address && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {p.address}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

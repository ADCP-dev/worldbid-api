import { useStore } from '@nanostores/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { countryFeatures } from '../stores/globe';
import { selectCountry } from '../stores/ui';
import { centroid, countryName } from '../lib/geojson';

export default function SearchBar() {
  const features = useStore(countryFeatures);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return features
      .filter((f) => {
        const name = ((f.properties.ADMIN as string) || '').toLowerCase();
        return name.includes(query) || f.__iso2.toLowerCase().includes(query);
      })
      .slice(0, 8);
  }, [q, features]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  function pick(iso2: string) {
    selectCountry(iso2);
    const f = features.find((x) => x.__iso2 === iso2);
    if (f) {
      const c = centroid(f);
      // the globe script subscribes to flyTo and will perform world.pointOfView(...);
      // but selectCountry already increments clicks; the fly is handled by
      // selectedIso2 subscribe in Globe.astro. We still import requestFlyTo lazily
      // to keep the path explicit when the sidebar is closed (no selection fly).
      if (c) {
        import('../stores/globe').then(({ requestFlyTo }) => requestFlyTo(c.lat, c.lng, 1.4));
      }
    }
    setQ('');
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && matches[0]) pick(matches[0].__iso2);
    if (e.key === 'Escape') setOpen(false);
  }

  return (
    <div className="search-wrap" ref={wrapRef}>
      <input
        type="search"
        placeholder="Search countries…"
        aria-label="Search countries"
        autoComplete="off"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 ? (
        <div className="search-results glass">
          {matches.map((f) => (
            <div className="row" key={f.__iso2} onClick={() => pick(f.__iso2)}>
              <span className="code">{f.__iso2}</span>
              {countryName(f.__iso2, features)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
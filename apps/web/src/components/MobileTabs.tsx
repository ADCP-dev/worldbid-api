// MobileTabs — bottom tab bar for mobile (< 768px). Toggles body classes
// to show/hide the three bottom-sheet panels: World Order, Live Activity,
// Country Card. Auto-switches to "country" when a country is selected.
// Includes a close (X) on each panel to dismiss the bottom sheet.

import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { selectedIso2, selectCountry } from '../stores/ui';

type Tab = 'world' | 'activity' | 'country' | null;

export default function MobileTabs() {
  const iso2 = useStore(selectedIso2);
  const [tab, setTab] = useState<Tab>('world');

  // Auto-switch to country tab when a country is selected.
  useEffect(() => {
    if (iso2) setTab('country');
  }, [iso2]);

  // Sync body class.
  useEffect(() => {
    document.body.classList.remove('mobile-tab-world', 'mobile-tab-activity', 'mobile-tab-country');
    if (tab) document.body.classList.add('mobile-tab-' + tab);
    return () => {
      document.body.classList.remove('mobile-tab-world', 'mobile-tab-activity', 'mobile-tab-country');
    };
  }, [tab]);

  function close() {
    if (tab === 'country') selectCountry(null);
    setTab(null);
  }

  return (
    <>
      <nav className="mobile-tabs" data-testid="mobile-tabs">
        <button className={tab === 'world' ? 'active' : ''} onClick={() => setTab('world')}>🌍 World</button>
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>⚡ Activity</button>
        <button className={tab === 'country' ? 'active' : ''} onClick={() => setTab('country')} disabled={!iso2}>📍 Country</button>
      </nav>
      {/* Close button (X) on the active panel — positioned by CSS */}
      {tab && (
        <button className="mobile-panel-close" onClick={close} aria-label="Close panel">✕</button>
      )}
    </>
  );
}
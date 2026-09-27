import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Shell } from '../app/Shell.js';

// The content-review harness (every drill and the attribute browser on one page) stays reachable
// at ?harness. Loaded lazily so its global stylesheet never touches the product shell.
const Harness = lazy(() => import('./App.js').then((m) => ({ default: m.App })));

const container = document.getElementById('root');
if (!container) throw new Error('missing #root');

const harness = new URLSearchParams(window.location.search).has('harness');

createRoot(container).render(
  <StrictMode>
    {harness ? (
      <Suspense fallback={null}>
        <Harness />
      </Suspense>
    ) : (
      <Shell />
    )}
  </StrictMode>,
);

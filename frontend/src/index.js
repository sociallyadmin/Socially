import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/App.css';

// Device detection and scaling
function setDeviceScale() {
  try {
    const width = window.innerWidth || document.documentElement.clientWidth;
    const ua = navigator.userAgent || navigator.vendor || '';
    const dpr = window.devicePixelRatio || 1;
    // device bucket (used for CSS classes) is stored in `bucket` below

    // Use width-first heuristics, UA as a fallback/helpful hint
    if (/Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(ua)) {
      // mobile-ish UA present — rely more on width buckets below
    }

    // finer-grained breakpoints
    // <=360: small mobile (older phones)
    // 361-480: mobile
    // 481-640: phablet / large phone
    // 641-900: tablet / small tablet
    // 901-1200: small laptop / large tablet
    // >1200: desktop
    let bucket = 'desktop';
    if (width <= 360) bucket = 'small-mobile';
    else if (width <= 480) bucket = 'mobile';
    else if (width <= 640) bucket = 'phablet';
    else if (width <= 900) bucket = 'tablet';
    else if (width <= 1200) bucket = 'laptop';
    else bucket = 'desktop';

    // base scale multipliers — tweakable
    const scaleMap = {
      'small-mobile': 0.92,
      mobile: 0.96,
      phablet: 0.99,
      tablet: 1,
      laptop: 1.03,
      desktop: 1.06,
    };

    // Slightly adjust for high-DPR devices so text doesn't become tiny on retina
    const dprAdjust = dpr > 1.5 ? 1 + (dpr - 1) * 0.02 : 1;

    const rawScale = scaleMap[bucket] || 1;
    const scale = Math.max(0.85, Math.min(1.2, Number((rawScale * dprAdjust).toFixed(3))));

    document.documentElement.style.setProperty('--scale', String(scale));

    // set a device class we can inspect in the DOM for debugging/styling
    document.documentElement.classList.remove(
      'device-small-mobile',
      'device-mobile',
      'device-phablet',
      'device-tablet',
      'device-laptop',
      'device-desktop'
    );
    document.documentElement.classList.add(`device-${bucket}`);
  } catch (err) {
    console.warn('setDeviceScale failed', err);
  }
}

setDeviceScale();
window.addEventListener('resize', () => {
  // debounce quick resizes
  if (window._deviceScaleTimeout) clearTimeout(window._deviceScaleTimeout);
  window._deviceScaleTimeout = setTimeout(() => setDeviceScale(), 120);
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

# Shot Timer Pro

A professional-grade, web-based Progressive Web App (PWA) Shot Timer specifically designed for shooting practice, running entirely locally in your browser.

## Features

- **Accurate Audio Detection:** Uses the local HTML5 Web Audio API to detect gunshots via microphone peaks with minimal latency.
- **Start Delays & Par Time:** Configurable delays (Instant, Fixed 3s, Random 2-5s) and Par Time alarms.
- **Adjustable Sensitivity:** Features a real-time visual sensitivity slider to easily tune out background noise or switch between Live Fire (9mm) and Dry Fire thresholds.
- **Auto-Stop:** Automatically stops and saves your timer run after a targeted number of shots are detected.
- **Run History & Geolocation:** Automatically saves your sequential strings directly to your browser's persistent `localStorage` and tags runs natively with your iPhone's GPS coordinates.
- **PWA Ready:** Can be added directly to an iOS or Android Home Screen for a seamless, offline-capable native app experience.
- **Import / Export:** Safely export your string data history to `.json` files for external backups, and instantly import it back at any time.
- **Cyberpunk Dark Mode UI:** OLED-friendly pure dark theme with reactive glowing neon typography, a massive touch interface, and chromatic aberration glitch effects for extreme high-contrast visibility on the range.

## Deployment

This application operates entirely client-side. No backend server or database is required. 
Simply host the repository via [GitHub Pages](https://pages.github.com/) or any static file host.

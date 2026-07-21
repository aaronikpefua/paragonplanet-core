import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import "./index.css";

const PLAY_AGE_SIGNAL_KEYS = [
  "playAgeLower",
  "playAgeUpper",
  "playAgeUserStatus",
];

const ANDROID_LAUNCH_DIAGNOSTIC_KEYS = [
  "pp_auto_provider",
  "pp_auto_launch_mode",
  "pp_forced_provider",
  "pp_android_release",
];

function capturePlayAgeSignals() {
  try {
    const params = new URLSearchParams(window.location.search);
    const signals = PLAY_AGE_SIGNAL_KEYS.reduce((acc, key) => {
      const value = params.get(key);
      if (value !== null) acc[key] = value;
      return acc;
    }, {});

    if (Object.keys(signals).length) {
      localStorage.setItem(
        "paragonPlayAgeSignals",
        JSON.stringify({ ...signals, capturedAt: new Date().toISOString() })
      );
    }
  } catch (error) {
    console.warn("Could not capture Play Age Signals:", error);
  }
}

function captureAndroidLaunchDiagnostics() {
  try {
    const params = new URLSearchParams(window.location.search);
    const diagnostics = ANDROID_LAUNCH_DIAGNOSTIC_KEYS.reduce((acc, key) => {
      const value = params.get(key);
      if (value !== null) acc[key] = value;
      return acc;
    }, {});

    localStorage.setItem(
      "paragonAndroidLaunchContext",
      JSON.stringify({
        ...diagnostics,
        launchHref: window.location.href,
        launchOrigin: window.location.origin,
        launchHost: window.location.hostname,
        referrer: document.referrer || "none",
        capturedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Could not capture Android launch diagnostics:", error);
  }
}

capturePlayAgeSignals();
captureAndroidLaunchDiagnostics();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Paragon Planet service worker registration failed:", error);
    });
  });
}

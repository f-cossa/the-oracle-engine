import { useSyncExternalStore } from "react";

export type ThemeId = "oraculo" | "branco" | "custom";
export type AmbienceCategory =
  | "mistery"
  | "philosophy"
  | "tech"
  | "universe"
  | "history"
  | "motivation"
  | "nature";

export interface AppSettings {
  theme: ThemeId;
  customColor: string; // hex bg color
  customImage: string | null; // data URL
  customOpacity: number; // 0..1 (overlay strength)
  ambienceEnabled: boolean;
  ambienceCategory: AmbienceCategory;
  ambienceVolume: number; // 0..1
  voiceEnabled: boolean;
  notificationsEnabled: boolean;
}

const KEY = "voz-verdade-settings-v1";

const DEFAULTS: AppSettings = {
  theme: "oraculo",
  customColor: "#050506",
  customImage: null,
  customOpacity: 0.4,
  ambienceEnabled: false,
  ambienceCategory: "mistery",
  ambienceVolume: 0.35,
  voiceEnabled: true,
  notificationsEnabled: false,
};

let state: AppSettings = DEFAULTS;
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  applyTheme(state);
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function applyTheme(s: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", s.theme);

  if (s.theme === "custom") {
    root.style.setProperty("--obsidian", s.customColor);
    root.style.setProperty("--app-bg-image", s.customImage ? `url(${s.customImage})` : "none");
    root.style.setProperty("--app-bg-opacity", String(s.customOpacity));
  } else {
    root.style.removeProperty("--obsidian");
    root.style.setProperty("--app-bg-image", "none");
    root.style.setProperty("--app-bg-opacity", "0");
  }
}

export function setSettings(patch: Partial<AppSettings>) {
  state = { ...state, ...patch };
  persist();
  applyTheme(state);
  listeners.forEach((l) => l());
}

export function getSettings() {
  return state;
}

export function useAppSettings(): AppSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => DEFAULTS,
  );
}

if (typeof window !== "undefined") load();

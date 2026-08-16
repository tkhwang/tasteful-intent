import { LazyStore } from "@tauri-apps/plugin-store";
import type { LayoutSettings } from "@/types/library";
import {
  parseSettingsForStorage,
  parseStoredSettings,
} from "./settingsParsing";

const store = new LazyStore("settings.json");
const settingKeys = [
  "libraryRoot",
  "docsRoot",
  "docsSourceMode",
  "docsPinnedRoots",
  "docsRoots",
  "docsPinnedRoot",
  "activeSpace",
  "folderPaneOpen",
  "listPaneOpen",
  "documentDensity",
  "documentSort",
  "theme",
  "spacePalette",
  "language",
  "writingFont",
  "tabSessions",
] as const;

type PaneLayout = Pick<LayoutSettings, "folderPaneOpen" | "listPaneOpen">;

export function nextPaneLayout(current: PaneLayout): PaneLayout {
  if (!current.listPaneOpen)
    return { folderPaneOpen: true, listPaneOpen: true };
  if (current.folderPaneOpen)
    return { folderPaneOpen: false, listPaneOpen: true };
  return { folderPaneOpen: false, listPaneOpen: false };
}

export async function loadSettings(): Promise<LayoutSettings> {
  const values = await Promise.all(
    settingKeys.map((key) => store.get<unknown>(key)),
  );
  return parseStoredSettings(
    Object.fromEntries(settingKeys.map((key, index) => [key, values[index]])),
  );
}

export async function saveSettings(settings: LayoutSettings): Promise<void> {
  const parsed = parseSettingsForStorage(settings);
  await Promise.all([
    ...Object.entries(parsed).map(([key, value]) => store.set(key, value)),
    store.set("docsRoots", []),
  ]);
  await store.save();
}

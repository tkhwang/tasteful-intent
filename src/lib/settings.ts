import { LazyStore } from "@tauri-apps/plugin-store";
import { z } from "zod";
import {
  LANGUAGES,
  type LayoutSettings,
  SPACES,
  THEMES,
  WRITING_FONTS,
} from "@/types/library";

const store = new LazyStore("settings.json");

const tabSessionSchema = z.object({
  paths: z.array(z.string()),
  activePath: z.string().nullable(),
});

const themeSchema = z.enum(THEMES);
const languageSchema = z.enum(LANGUAGES);
const writingFontSchema = z.enum(WRITING_FONTS);

const settingsSchema = z.object({
  libraryRoot: z.string().min(1).nullable(),
  docsRoot: z.string().min(1).nullable(),
  activeSpace: z.enum(SPACES),
  folderPaneOpen: z.boolean(),
  listPaneOpen: z.boolean(),
  theme: themeSchema,
  language: languageSchema,
  writingFont: writingFontSchema,
  tabSessions: z.object({
    intent: tabSessionSchema,
    docs: tabSessionSchema,
  }),
});

const defaultSettings: LayoutSettings = {
  libraryRoot: null,
  docsRoot: null,
  activeSpace: "intent",
  folderPaneOpen: true,
  listPaneOpen: true,
  theme: "light",
  language: "en",
  writingFont: "sans",
  tabSessions: {
    intent: { paths: [], activePath: null },
    docs: { paths: [], activePath: null },
  },
};

type PaneLayout = Pick<LayoutSettings, "folderPaneOpen" | "listPaneOpen">;

export function nextPaneLayout(current: PaneLayout): PaneLayout {
  if (!current.listPaneOpen) {
    return { folderPaneOpen: true, listPaneOpen: true };
  }
  if (current.folderPaneOpen) {
    return { folderPaneOpen: false, listPaneOpen: true };
  }
  return { folderPaneOpen: false, listPaneOpen: false };
}

export async function loadSettings(): Promise<LayoutSettings> {
  const [
    libraryRoot,
    docsRoot,
    activeSpace,
    folderPaneOpen,
    listPaneOpen,
    theme,
    language,
    writingFont,
    tabSessions,
  ] = await Promise.all([
    store.get<unknown>("libraryRoot"),
    store.get<unknown>("docsRoot"),
    store.get<unknown>("activeSpace"),
    store.get<unknown>("folderPaneOpen"),
    store.get<unknown>("listPaneOpen"),
    store.get<unknown>("theme"),
    store.get<unknown>("language"),
    store.get<unknown>("writingFont"),
    store.get<unknown>("tabSessions"),
  ]);
  const parsedTheme = themeSchema.safeParse(theme ?? defaultSettings.theme);
  const parsedLanguage = languageSchema.safeParse(
    language ?? defaultSettings.language,
  );
  const parsedWritingFont = writingFontSchema.safeParse(
    writingFont ?? defaultSettings.writingFont,
  );
  const parsed = settingsSchema.safeParse({
    libraryRoot: libraryRoot ?? defaultSettings.libraryRoot,
    docsRoot: docsRoot ?? defaultSettings.docsRoot,
    activeSpace: activeSpace ?? defaultSettings.activeSpace,
    folderPaneOpen: folderPaneOpen ?? defaultSettings.folderPaneOpen,
    listPaneOpen: listPaneOpen ?? defaultSettings.listPaneOpen,
    theme: parsedTheme.success ? parsedTheme.data : defaultSettings.theme,
    language: parsedLanguage.success
      ? parsedLanguage.data
      : defaultSettings.language,
    writingFont: parsedWritingFont.success
      ? parsedWritingFont.data
      : defaultSettings.writingFont,
    tabSessions: tabSessions ?? defaultSettings.tabSessions,
  });
  return parsed.success ? parsed.data : defaultSettings;
}

export async function saveSettings(settings: LayoutSettings): Promise<void> {
  const parsed = settingsSchema.parse(settings);
  await Promise.all([
    store.set("libraryRoot", parsed.libraryRoot),
    store.set("docsRoot", parsed.docsRoot),
    store.set("activeSpace", parsed.activeSpace),
    store.set("folderPaneOpen", parsed.folderPaneOpen),
    store.set("listPaneOpen", parsed.listPaneOpen),
    store.set("theme", parsed.theme),
    store.set("language", parsed.language),
    store.set("writingFont", parsed.writingFont),
    store.set("tabSessions", parsed.tabSessions),
  ]);
  await store.save();
}

import { LazyStore } from "@tauri-apps/plugin-store";
import { z } from "zod";
import {
  DOCUMENT_DENSITIES,
  DOCUMENT_SORTS,
  type DocsDocumentRef,
  type DocsTabSession,
  LANGUAGES,
  type LayoutSettings,
  SPACE_PALETTES,
  SPACES,
  THEMES,
  WRITING_FONTS,
} from "@/types/library";

const store = new LazyStore("settings.json");

const tabSessionSchema = z.object({
  paths: z.array(z.string()),
  activePath: z.string().nullable(),
});

const relativeDocumentPathSchema = z
  .string()
  .min(1)
  .refine(
    (path) =>
      !path.startsWith("/") &&
      path.endsWith(".md") &&
      path
        .split("/")
        .every((part) => part !== "" && part !== ".." && !part.startsWith(".")),
  );
const docsDocumentRefSchema = z.object({
  root: z.string().min(1),
  path: relativeDocumentPathSchema,
});
const docsTabSessionSchema = z.object({
  documents: z.array(docsDocumentRefSchema),
  active: docsDocumentRefSchema.nullable(),
});

const themeSchema = z.enum(THEMES);
const spacePaletteSchema = z.enum(SPACE_PALETTES);
const languageSchema = z.enum(LANGUAGES);
const writingFontSchema = z.enum(WRITING_FONTS);
const documentDensitySchema = z.enum(DOCUMENT_DENSITIES);
const documentSortSchema = z.enum(DOCUMENT_SORTS);
const nullableRootSchema = z.string().min(1).nullable();
const paneFlagSchema = z.boolean();
const activeSpaceSchema = z.enum(SPACES);
const tabSessionsSchema = z.object({
  intent: tabSessionSchema,
  docs: docsTabSessionSchema,
});

const settingsSchema = z.object({
  libraryRoot: nullableRootSchema,
  docsRoot: nullableRootSchema,
  activeSpace: activeSpaceSchema,
  folderPaneOpen: paneFlagSchema,
  listPaneOpen: paneFlagSchema,
  documentDensity: documentDensitySchema,
  documentSort: documentSortSchema,
  theme: themeSchema,
  spacePalette: spacePaletteSchema,
  language: languageSchema,
  writingFont: writingFontSchema,
  tabSessions: tabSessionsSchema,
});

const defaultSettings: LayoutSettings = {
  libraryRoot: null,
  docsRoot: null,
  activeSpace: "intent",
  folderPaneOpen: true,
  listPaneOpen: true,
  documentDensity: "full",
  documentSort: "updated",
  theme: "light",
  spacePalette: "classic",
  language: "en",
  writingFont: "sans",
  tabSessions: {
    intent: { paths: [], activePath: null },
    docs: { documents: [], active: null },
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
    documentDensity,
    theme,
    spacePalette,
    language,
    writingFont,
    documentSort,
    tabSessions,
  ] = await Promise.all([
    store.get<unknown>("libraryRoot"),
    store.get<unknown>("docsRoot"),
    store.get<unknown>("activeSpace"),
    store.get<unknown>("folderPaneOpen"),
    store.get<unknown>("listPaneOpen"),
    store.get<unknown>("documentDensity"),
    store.get<unknown>("theme"),
    store.get<unknown>("spacePalette"),
    store.get<unknown>("language"),
    store.get<unknown>("writingFont"),
    store.get<unknown>("documentSort"),
    store.get<unknown>("tabSessions"),
  ]);
  const parsedDocsRoot = parseOrDefault(
    nullableRootSchema,
    docsRoot,
    defaultSettings.docsRoot,
  );
  const sessions = parseTabSessions(tabSessions, parsedDocsRoot);
  const nextDocsRoot =
    sessions.docs.active?.root ??
    sessions.docs.documents[0]?.root ??
    parsedDocsRoot;

  return {
    libraryRoot: parseOrDefault(
      nullableRootSchema,
      libraryRoot,
      defaultSettings.libraryRoot,
    ),
    docsRoot: nextDocsRoot,
    activeSpace: parseOrDefault(
      activeSpaceSchema,
      activeSpace,
      defaultSettings.activeSpace,
    ),
    folderPaneOpen: parseOrDefault(
      paneFlagSchema,
      folderPaneOpen,
      defaultSettings.folderPaneOpen,
    ),
    listPaneOpen: parseOrDefault(
      paneFlagSchema,
      listPaneOpen,
      defaultSettings.listPaneOpen,
    ),
    documentDensity: parseOrDefault(
      documentDensitySchema,
      documentDensity,
      defaultSettings.documentDensity,
    ),
    documentSort: parseOrDefault(
      documentSortSchema,
      documentSort,
      defaultSettings.documentSort,
    ),
    theme: parseOrDefault(themeSchema, theme, defaultSettings.theme),
    spacePalette: parseOrDefault(
      spacePaletteSchema,
      spacePalette,
      defaultSettings.spacePalette,
    ),
    language: parseOrDefault(
      languageSchema,
      language,
      defaultSettings.language,
    ),
    writingFont: parseOrDefault(
      writingFontSchema,
      writingFont,
      defaultSettings.writingFont,
    ),
    tabSessions: sessions,
  };
}

export async function saveSettings(settings: LayoutSettings): Promise<void> {
  const parsed = settingsSchema.parse(settings);
  await Promise.all([
    store.set("libraryRoot", parsed.libraryRoot),
    store.set("docsRoot", parsed.docsRoot),
    store.set("activeSpace", parsed.activeSpace),
    store.set("folderPaneOpen", parsed.folderPaneOpen),
    store.set("listPaneOpen", parsed.listPaneOpen),
    store.set("documentDensity", parsed.documentDensity),
    store.set("documentSort", parsed.documentSort),
    store.set("theme", parsed.theme),
    store.set("spacePalette", parsed.spacePalette),
    store.set("language", parsed.language),
    store.set("writingFont", parsed.writingFont),
    store.set("tabSessions", parsed.tabSessions),
  ]);
  await store.save();
}

function parseTabSessions(
  value: unknown,
  legacyDocsRoot: string | null,
): LayoutSettings["tabSessions"] {
  const record = isRecord(value) ? value : {};
  const intent = parseOrDefault(
    tabSessionSchema,
    record.intent,
    defaultSettings.tabSessions.intent,
  );
  const docs =
    parseStoredDocsSession(record.docs) ??
    migrateLegacyDocsSession(record.docs, legacyDocsRoot);
  return { intent, docs };
}

function migrateLegacyDocsSession(
  value: unknown,
  legacyDocsRoot: string | null,
): DocsTabSession {
  const legacy = tabSessionSchema.safeParse(value);
  if (!legacy.success || !legacyDocsRoot)
    return defaultSettings.tabSessions.docs;
  const documents = legacy.data.paths
    .filter((path) => relativeDocumentPathSchema.safeParse(path).success)
    .map((path) => ({ root: legacyDocsRoot, path }));
  const active = legacy.data.activePath
    ? (documents.find(
        (reference) => reference.path === legacy.data.activePath,
      ) ?? null)
    : null;
  return { documents: uniqueDocumentRefs(documents), active };
}

function parseStoredDocsSession(value: unknown): DocsTabSession | null {
  if (!isRecord(value) || !Array.isArray(value.documents)) return null;
  const documents = uniqueDocumentRefs(
    value.documents.flatMap((candidate) => {
      const parsed = docsDocumentRefSchema.safeParse(candidate);
      return parsed.success ? [parsed.data] : [];
    }),
  );
  const parsedActive = docsDocumentRefSchema.nullable().safeParse(value.active);
  const requestedActive = parsedActive.success ? parsedActive.data : null;
  const active = requestedActive
    ? (documents.find(
        (reference) =>
          reference.root === requestedActive.root &&
          reference.path === requestedActive.path,
      ) ?? null)
    : null;
  return { documents, active };
}

function uniqueDocumentRefs(
  references: readonly DocsDocumentRef[],
): DocsDocumentRef[] {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.root}\0${reference.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOrDefault<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallback: T,
): T {
  const parsed = schema.safeParse(value ?? fallback);
  return parsed.success ? parsed.data : fallback;
}

import { z } from "zod";
import {
  suggestDocsFolderLabel,
  validateDocsFolderLabel,
} from "@/lib/docsFolderLabel";
import {
  DOCS_SOURCE_MODES,
  DOCUMENT_DENSITIES,
  DOCUMENT_SORTS,
  LANGUAGES,
  type LayoutSettings,
  SPACE_PALETTES,
  SPACES,
  type TabSession,
  THEMES,
  WRITING_FONTS,
} from "@/types/library";

const plainTabSessionSchema = z.object({
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
const docsTabSessionSchema = z.object({
  paths: z.array(relativeDocumentPathSchema),
  activePath: relativeDocumentPathSchema.nullable(),
});
const pinnedRootSchema = z.object({
  root: z.string().min(1),
  label: z.string().transform(validateDocsFolderLabel).pipe(z.string()),
});
const nullableRootSchema = z.string().min(1).nullable();
const settingsSchema = z.object({
  libraryRoot: nullableRootSchema,
  docsRoot: nullableRootSchema,
  docsSourceMode: z.enum(DOCS_SOURCE_MODES),
  docsPinnedRoots: z.array(pinnedRootSchema),
  docsPinnedRoot: nullableRootSchema,
  activeSpace: z.enum(SPACES),
  folderPaneOpen: z.boolean(),
  listPaneOpen: z.boolean(),
  documentDensity: z.enum(DOCUMENT_DENSITIES),
  documentSort: z.enum(DOCUMENT_SORTS),
  theme: z.enum(THEMES),
  spacePalette: z.enum(SPACE_PALETTES),
  language: z.enum(LANGUAGES),
  writingFont: z.enum(WRITING_FONTS),
  tabSessions: z.object({
    intent: plainTabSessionSchema,
    docs: docsTabSessionSchema,
    docsPinned: z.record(z.string(), docsTabSessionSchema),
  }),
});

export const defaultSettings: LayoutSettings = {
  libraryRoot: null,
  docsRoot: null,
  docsSourceMode: "browse",
  docsPinnedRoots: [],
  docsPinnedRoot: null,
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
    docs: { paths: [], activePath: null },
    docsPinned: {},
  },
};

export function parseStoredSettings(
  stored: Record<string, unknown>,
): LayoutSettings {
  const restoreBrowse = isFolderFirstMode(stored.docsSourceMode);
  const pinnedRoots = parsePinnedRoots(
    stored.docsPinnedRoots,
    stored.docsRoots,
  );
  const pinnedRootPaths = pinnedRoots.map(({ root }) => root);
  const sessions = parseTabSessions(
    stored.tabSessions,
    pinnedRootPaths,
    restoreBrowse,
  );
  const pinnedRoot = parse(nullableRootSchema, stored.docsPinnedRoot, null);
  return {
    libraryRoot: parse(nullableRootSchema, stored.libraryRoot, null),
    docsRoot: restoreBrowse
      ? parse(nullableRootSchema, stored.docsRoot, null)
      : null,
    docsSourceMode: parseDocsSourceMode(stored.docsSourceMode),
    docsPinnedRoots: pinnedRoots,
    docsPinnedRoot:
      pinnedRoot && pinnedRootPaths.includes(pinnedRoot) ? pinnedRoot : null,
    activeSpace: parse(z.enum(SPACES), stored.activeSpace, "intent"),
    folderPaneOpen: parse(z.boolean(), stored.folderPaneOpen, true),
    listPaneOpen: parse(z.boolean(), stored.listPaneOpen, true),
    documentDensity: parse(
      z.enum(DOCUMENT_DENSITIES),
      stored.documentDensity,
      "full",
    ),
    documentSort: parse(z.enum(DOCUMENT_SORTS), stored.documentSort, "updated"),
    theme: parse(z.enum(THEMES), stored.theme, "light"),
    spacePalette: parse(z.enum(SPACE_PALETTES), stored.spacePalette, "classic"),
    language: parse(z.enum(LANGUAGES), stored.language, "en"),
    writingFont: parse(z.enum(WRITING_FONTS), stored.writingFont, "sans"),
    tabSessions: sessions,
  };
}

export function parseSettingsForStorage(settings: LayoutSettings) {
  return settingsSchema.parse(settings);
}

function parseDocsSourceMode(value: unknown): LayoutSettings["docsSourceMode"] {
  if (value === "pinned" || value === "pinned-folders") return "pinned";
  return "browse";
}

function isFolderFirstMode(value: unknown): boolean {
  return value === "browse" || value === "pinned";
}

function parsePinnedRoots(value: unknown, legacyValue: unknown) {
  const parsed = z.array(pinnedRootSchema).safeParse(value);
  if (parsed.success) return uniquePinnedRoots(parsed.data);
  if (!Array.isArray(legacyValue)) return defaultSettings.docsPinnedRoots;
  const roots = legacyValue.flatMap((candidate) => {
    const root = z.string().min(1).safeParse(candidate);
    return root.success
      ? [{ root: root.data, label: suggestDocsFolderLabel(root.data) }]
      : [];
  });
  return uniquePinnedRoots(roots);
}

function uniquePinnedRoots(
  roots: LayoutSettings["docsPinnedRoots"],
): LayoutSettings["docsPinnedRoots"] {
  const seen = new Set<string>();
  return roots.filter(({ root }) => {
    if (seen.has(root)) return false;
    seen.add(root);
    return true;
  });
}

function parseTabSessions(
  value: unknown,
  pinnedRoots: readonly string[],
  restoreBrowse: boolean,
): LayoutSettings["tabSessions"] {
  const record = isRecord(value) ? value : {};
  const intent = normalizeSession(
    parse(
      plainTabSessionSchema,
      record.intent,
      defaultSettings.tabSessions.intent,
    ),
  );
  return {
    intent,
    docs: restoreBrowse
      ? parseDocsSession(record.docs)
      : defaultSettings.tabSessions.docs,
    docsPinned: parsePinnedSessions(record.docsPinned, pinnedRoots),
  };
}

function parsePinnedSessions(value: unknown, roots: readonly string[]) {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(
    roots.flatMap((root) =>
      isRecord(record[root])
        ? ([[root, parseDocsSession(record[root])]] as const)
        : [],
    ),
  );
}

function parseDocsSession(value: unknown): TabSession {
  if (!isRecord(value)) return { paths: [], activePath: null };
  const candidates = Array.isArray(value.paths) ? value.paths : [];
  const paths = candidates.flatMap((candidate) => {
    const parsed = relativeDocumentPathSchema.safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
  const active = relativeDocumentPathSchema
    .nullable()
    .safeParse(value.activePath);
  return normalizeSession({
    paths,
    activePath: active.success ? active.data : null,
  });
}

function normalizeSession(session: TabSession): TabSession {
  const paths = [...new Set(session.paths)];
  return {
    paths,
    activePath:
      session.activePath && paths.includes(session.activePath)
        ? session.activePath
        : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parse<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value ?? fallback);
  return parsed.success ? parsed.data : fallback;
}

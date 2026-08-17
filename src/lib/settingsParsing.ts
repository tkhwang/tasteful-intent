import { z } from "zod";
import {
  suggestDocsFolderLabel,
  validateDocsFolderLabel,
} from "@/lib/docsFolderLabel";
import {
  DOCUMENT_DENSITIES,
  DOCUMENT_SORTS,
  type DocsRootEntry,
  type DocsRootSessions,
  LANGUAGES,
  type LayoutSettings,
  SPACE_PALETTES,
  SPACES,
  type TabSession,
  THEMES,
  WRITING_FONTS,
} from "@/types/library";

export const SETTINGS_SCHEMA_VERSION = 2;

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
const validLabelSchema = z
  .string()
  .transform(validateDocsFolderLabel)
  .pipe(z.string());
const docsRootEntryStorageSchema = z.object({
  root: z.string().min(1),
  label: validLabelSchema.nullable(),
});
const nullableRootSchema = z.string().min(1).nullable();
const settingsSchema = z
  .object({
    settingsSchemaVersion: z.literal(SETTINGS_SCHEMA_VERSION),
    libraryRoot: nullableRootSchema,
    docsRoots: z.array(docsRootEntryStorageSchema),
    docsRoot: nullableRootSchema,
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
      docs: z.record(z.string(), docsTabSessionSchema),
    }),
  })
  .superRefine((settings, context) => {
    const roots = settings.docsRoots.map(({ root }) => root);
    if (new Set(roots).size !== roots.length) {
      context.addIssue({
        code: "custom",
        path: ["docsRoots"],
        message: "AI folder roots must be unique",
      });
    }
    if (settings.docsRoot && !roots.includes(settings.docsRoot)) {
      context.addIssue({
        code: "custom",
        path: ["docsRoot"],
        message: "The active AI folder must belong to docsRoots",
      });
    }
    let foundUnpinned = false;
    for (const [index, entry] of settings.docsRoots.entries()) {
      if (entry.label === null) foundUnpinned = true;
      if (foundUnpinned && entry.label !== null) {
        context.addIssue({
          code: "custom",
          path: ["docsRoots", index],
          message: "Pinned AI folders must precede unpinned folders",
        });
      }
    }
  });

export const defaultSettings: LayoutSettings = {
  settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
  libraryRoot: null,
  docsRoots: [],
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
    docs: {},
  },
};

type ParsedDocsSettings = Pick<LayoutSettings, "docsRoots" | "docsRoot"> & {
  readonly docsSessions: DocsRootSessions;
};

export function parseStoredSettings(
  stored: Record<string, unknown>,
): LayoutSettings {
  const docs =
    stored.settingsSchemaVersion === SETTINGS_SCHEMA_VERSION
      ? parseVersionTwoDocs(stored)
      : migrateLegacyDocs(stored);
  const tabSessions = isRecord(stored.tabSessions) ? stored.tabSessions : {};

  return {
    settingsSchemaVersion: SETTINGS_SCHEMA_VERSION,
    libraryRoot: parse(nullableRootSchema, stored.libraryRoot, null),
    docsRoots: docs.docsRoots,
    docsRoot: docs.docsRoot,
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
    tabSessions: {
      intent: normalizeSession(
        parse(
          plainTabSessionSchema,
          tabSessions.intent,
          defaultSettings.tabSessions.intent,
        ),
      ),
      docs: docs.docsSessions,
    },
  };
}

export function parseSettingsForStorage(settings: LayoutSettings) {
  return settingsSchema.parse(settings);
}

function parseVersionTwoDocs(
  stored: Record<string, unknown>,
): ParsedDocsSettings {
  const docsRoots = stablePinnedFirst(parseVersionTwoRoots(stored.docsRoots));
  const rootPaths = docsRoots.map(({ root }) => root);
  const requestedRoot = parse(nullableRootSchema, stored.docsRoot, null);
  const sessions = isRecord(stored.tabSessions)
    ? parseRootSessions(stored.tabSessions.docs, rootPaths)
    : {};
  return {
    docsRoots,
    docsRoot:
      requestedRoot && rootPaths.includes(requestedRoot)
        ? requestedRoot
        : (rootPaths[0] ?? null),
    docsSessions: sessions,
  };
}

function migrateLegacyDocs(
  stored: Record<string, unknown>,
): ParsedDocsSettings {
  return hasCurrentDocsFields(stored)
    ? migrateCurrentDocs(stored)
    : migrateLeapfrogDocs(stored);
}

function hasCurrentDocsFields(stored: Record<string, unknown>): boolean {
  return [
    "docsBrowseRoots",
    "docsBrowseRoot",
    "docsPinnedRoots",
    "docsPinnedRoot",
  ].some((key) => stored[key] !== undefined);
}

function migrateCurrentDocs(
  stored: Record<string, unknown>,
): ParsedDocsSettings {
  const pinnedRoots = parseCurrentPinnedRoots(stored.docsPinnedRoots);
  const pinnedPaths = new Set(pinnedRoots.map(({ root }) => root));
  const browseRoots = parseStringRoots(stored.docsBrowseRoots)
    .filter((root) => !pinnedPaths.has(root))
    .map((root) => ({ root, label: null }));
  const docsRoots = stablePinnedFirst([...pinnedRoots, ...browseRoots]);
  const rootPaths = docsRoots.map(({ root }) => root);
  const sessions = isRecord(stored.tabSessions) ? stored.tabSessions : {};
  const preferPinned = isPinnedMode(stored.docsSourceMode);
  const docsSessions = Object.fromEntries(
    rootPaths.flatMap((root) => {
      const preferred = preferPinned
        ? sessions.docsPinned
        : sessions.docsBrowse;
      const secondary = preferPinned
        ? sessions.docsBrowse
        : sessions.docsPinned;
      const merged = mergeRootSessions(preferred, secondary, root);
      return merged ? [[root, merged]] : [];
    }),
  );
  const requestedRoot = parse(
    nullableRootSchema,
    preferPinned ? stored.docsPinnedRoot : stored.docsBrowseRoot,
    null,
  );
  return {
    docsRoots,
    docsRoot:
      requestedRoot && rootPaths.includes(requestedRoot)
        ? requestedRoot
        : (rootPaths[0] ?? null),
    docsSessions,
  };
}

function migrateLeapfrogDocs(
  stored: Record<string, unknown>,
): ParsedDocsSettings {
  const legacyPinnedRoots = parseStringRoots(stored.docsRoots).map((root) => ({
    root,
    label: suggestDocsFolderLabel(root),
  }));
  const requestedRoot = parse(nullableRootSchema, stored.docsRoot, null);
  const docsRoots =
    legacyPinnedRoots.length > 0
      ? legacyPinnedRoots
      : requestedRoot && isFolderFirstMode(stored.docsSourceMode)
        ? [{ root: requestedRoot, label: null }]
        : [];
  const rootPaths = docsRoots.map(({ root }) => root);
  const docsRoot =
    requestedRoot && rootPaths.includes(requestedRoot)
      ? requestedRoot
      : (rootPaths[0] ?? null);
  const sessions = isRecord(stored.tabSessions) ? stored.tabSessions : {};
  const docsSession =
    docsRoot && isFolderFirstMode(stored.docsSourceMode)
      ? parseDocsSession(sessions.docs)
      : null;
  return {
    docsRoots,
    docsRoot,
    docsSessions: docsRoot && docsSession ? { [docsRoot]: docsSession } : {},
  };
}

function parseVersionTwoRoots(value: unknown): DocsRootEntry[] {
  if (!Array.isArray(value)) return [];
  const rootIndexes = new Map<string, number>();
  const roots: DocsRootEntry[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const root = z.string().min(1).safeParse(candidate.root);
    if (!root.success) continue;
    const label =
      typeof candidate.label === "string"
        ? validateDocsFolderLabel(candidate.label)
        : null;
    const existingIndex = rootIndexes.get(root.data);
    if (existingIndex !== undefined) {
      const existing = roots[existingIndex];
      if (existing?.label === null && label !== null) {
        roots[existingIndex] = { root: root.data, label };
      }
      continue;
    }
    rootIndexes.set(root.data, roots.length);
    roots.push({ root: root.data, label });
  }
  return roots;
}

function parseCurrentPinnedRoots(value: unknown): DocsRootEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const roots: DocsRootEntry[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    const root = z.string().min(1).safeParse(candidate.root);
    if (!root.success || seen.has(root.data)) continue;
    seen.add(root.data);
    const label =
      typeof candidate.label === "string"
        ? validateDocsFolderLabel(candidate.label)
        : null;
    roots.push({ root: root.data, label });
  }
  return roots;
}

function parseStringRoots(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const roots = value.flatMap((candidate) => {
    const parsed = z.string().min(1).safeParse(candidate);
    return parsed.success ? [parsed.data] : [];
  });
  return [...new Set(roots)];
}

function stablePinnedFirst(roots: readonly DocsRootEntry[]): DocsRootEntry[] {
  return [
    ...roots.filter(({ label }) => label !== null),
    ...roots.filter(({ label }) => label === null),
  ];
}

function mergeRootSessions(
  preferredValue: unknown,
  secondaryValue: unknown,
  root: string,
): TabSession | null {
  const preferredRecord = isRecord(preferredValue) ? preferredValue : {};
  const secondaryRecord = isRecord(secondaryValue) ? secondaryValue : {};
  const hasPreferred = isRecord(preferredRecord[root]);
  const hasSecondary = isRecord(secondaryRecord[root]);
  if (!hasPreferred && !hasSecondary) return null;
  const preferred = parseDocsSession(preferredRecord[root]);
  const secondary = parseDocsSession(secondaryRecord[root]);
  const paths = [...new Set([...preferred.paths, ...secondary.paths])];
  const activePath =
    preferred.activePath && paths.includes(preferred.activePath)
      ? preferred.activePath
      : secondary.activePath && paths.includes(secondary.activePath)
        ? secondary.activePath
        : null;
  return { paths, activePath };
}

function parseRootSessions(value: unknown, roots: readonly string[]) {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(
    roots.flatMap((root) =>
      isRecord(record[root]) ? [[root, parseDocsSession(record[root])]] : [],
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

function isPinnedMode(value: unknown): boolean {
  return value === "pinned" || value === "pinned-folders";
}

function isFolderFirstMode(value: unknown): boolean {
  return value === "browse" || isPinnedMode(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parse<T>(schema: z.ZodType<T>, value: unknown, fallback: T): T {
  const parsed = schema.safeParse(value ?? fallback);
  return parsed.success ? parsed.data : fallback;
}

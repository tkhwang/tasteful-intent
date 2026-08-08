export type FolderEntry = {
  readonly path: string;
  readonly parent: string;
  readonly name: string;
};

export type DocumentEntry = {
  readonly path: string;
  readonly parent: string;
  readonly title: string;
  readonly updatedMs: number;
};

export type LibrarySnapshot = {
  readonly folders: readonly FolderEntry[];
  readonly documents: readonly DocumentEntry[];
};

export type DocumentPayload = {
  readonly path: string;
  readonly content: string;
  readonly mtimeMs: number;
};

export type DocumentSnippet = {
  readonly path: string;
  readonly snippet: string | null;
};

export type EntryMutation = {
  readonly path: string;
};

export type OpenDocument = {
  readonly path: string;
  readonly title: string;
  readonly created: string;
  readonly updated: string;
  readonly body: string;
  readonly mtimeMs: number;
};

export type LayoutSettings = {
  readonly libraryRoot: string | null;
  readonly docsRoot: string | null;
  readonly activeSpace: Space;
  readonly folderPaneOpen: boolean;
  readonly listPaneOpen: boolean;
  readonly theme: Theme;
  readonly language: Language;
  readonly writingFont: WritingFont;
  readonly tabSessions: Record<Space, TabSession>;
};

export const SPACES = ["intent", "docs"] as const;
export type Space = (typeof SPACES)[number];

export const THEMES = ["light", "charcoal", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type ResolvedTheme = Exclude<Theme, "system">;

export const LANGUAGES = ["en", "ko"] as const;
export type Language = (typeof LANGUAGES)[number];

export const WRITING_FONTS = ["sans", "serif"] as const;
export type WritingFont = (typeof WRITING_FONTS)[number];

export type TabSession = {
  readonly paths: readonly string[];
  readonly activePath: string | null;
};

export const EDITOR_MODES = ["edit", "view", "split"] as const;
export type EditorMode = (typeof EDITOR_MODES)[number];

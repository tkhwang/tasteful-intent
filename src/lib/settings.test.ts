import { beforeEach, describe, expect, it, vi } from "vitest";

const storedValues = vi.hoisted(() => new Map<string, unknown>());

vi.mock("@tauri-apps/plugin-store", () => ({
  LazyStore: class {
    get(key: string) {
      return Promise.resolve(storedValues.get(key));
    }

    set(key: string, value: unknown) {
      storedValues.set(key, value);
      return Promise.resolve();
    }

    save() {
      return Promise.resolve();
    }
  },
}));

import { loadSettings, nextPaneLayout, saveSettings } from "./settings";

describe("settings", () => {
  beforeEach(() => {
    storedValues.clear();
  });

  it("starts without a Human or AI root when the store is empty", async () => {
    // Given: no persisted settings on first launch.
    // When / Then: loading settings must not invent either filesystem root.
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: null,
      docsRoot: null,
      documentDensity: "full",
      documentSort: "updated",
      language: "en",
      spacePalette: "classic",
      writingFont: "sans",
    });
  });

  it("round-trips the selected space palette", async () => {
    // Given: a valid non-default palette in an otherwise clean settings snapshot.
    const settings = await loadSettings();

    // When: the complete settings snapshot is persisted and loaded again.
    await saveSettings({ ...settings, spacePalette: "plum-moss" });

    // Then: the palette survives the settings boundary unchanged.
    await expect(loadSettings()).resolves.toMatchObject({
      spacePalette: "plum-moss",
    });
  });

  it("falls back only an invalid space palette", async () => {
    // Given: a damaged palette beside valid user preferences.
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("theme", "dark");
    storedValues.set("language", "ko");
    storedValues.set("spacePalette", "neon");

    // When / Then: only the palette returns to the classic default.
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      theme: "dark",
      language: "ko",
      spacePalette: "classic",
    });
  });

  it("loads a v0.1 store into the Intent space without moving its library", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("folderPaneOpen", false);
    storedValues.set("listPaneOpen", true);

    await expect(loadSettings()).resolves.toEqual({
      libraryRoot: "/memo/intent",
      docsRoot: null,
      activeSpace: "intent",
      folderPaneOpen: false,
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
    });
  });

  it("round-trips the independent Docs root and active space", async () => {
    await saveSettings({
      libraryRoot: "/memo/intent",
      docsRoot: "/memo/docs",
      activeSpace: "docs",
      folderPaneOpen: true,
      listPaneOpen: false,
      documentDensity: "simple",
      documentSort: "title",
      theme: "system",
      spacePalette: "plum-moss",
      language: "ko",
      writingFont: "serif",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {
          documents: [{ root: "/memo/docs", path: "reference.md" }],
          active: { root: "/memo/docs", path: "reference.md" },
        },
      },
    });

    await expect(loadSettings()).resolves.toEqual({
      libraryRoot: "/memo/intent",
      docsRoot: "/memo/docs",
      activeSpace: "docs",
      folderPaneOpen: true,
      listPaneOpen: false,
      documentDensity: "simple",
      documentSort: "title",
      theme: "system",
      spacePalette: "plum-moss",
      language: "ko",
      writingFont: "serif",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {
          documents: [{ root: "/memo/docs", path: "reference.md" }],
          active: { root: "/memo/docs", path: "reference.md" },
        },
      },
    });
  });

  it("persists only AI document references after a runtime mode change", async () => {
    // Given: runtime documents have changed mode, but the stored session is reference-only.
    const docsSessionAfterModeChange = {
      documents: [{ root: "/docs/a", path: "a.md", mode: "edit" as const }],
      active: { root: "/docs/a", path: "a.md", mode: "edit" as const },
    };

    // When: the complete settings snapshot is serialized to settings.json.
    await saveSettings({
      libraryRoot: "/memo/intent",
      docsRoot: "/docs/a",
      activeSpace: "docs",
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
        docs: docsSessionAfterModeChange,
      },
    });

    // Then: raw storage contains only the canonical DocsTabSession structure.
    expect(storedValues.get("tabSessions")).toEqual({
      intent: { paths: [], activePath: null },
      docs: {
        documents: [{ root: "/docs/a", path: "a.md" }],
        active: { root: "/docs/a", path: "a.md" },
      },
    });
    expect([...storedValues.keys()]).not.toContain("mode");
  });

  it("falls back only the invalid theme while preserving valid workspace settings", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("docsRoot", "/memo/docs");
    storedValues.set("activeSpace", "docs");
    storedValues.set("folderPaneOpen", false);
    storedValues.set("listPaneOpen", true);
    storedValues.set("theme", "neon");
    storedValues.set("language", "ko");
    storedValues.set("tabSessions", {
      intent: { paths: ["purpose.md"], activePath: "purpose.md" },
      docs: { paths: ["result.md"], activePath: "result.md" },
    });

    await expect(loadSettings()).resolves.toEqual({
      libraryRoot: "/memo/intent",
      docsRoot: "/memo/docs",
      activeSpace: "docs",
      folderPaneOpen: false,
      listPaneOpen: true,
      documentDensity: "full",
      documentSort: "updated",
      theme: "light",
      spacePalette: "classic",
      language: "ko",
      writingFont: "sans",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {
          documents: [{ root: "/memo/docs", path: "result.md" }],
          active: { root: "/memo/docs", path: "result.md" },
        },
      },
    });
  });

  it("falls back only an invalid language while preserving the selected theme", async () => {
    storedValues.set("theme", "charcoal");
    storedValues.set("language", "fr");

    await expect(loadSettings()).resolves.toMatchObject({
      theme: "charcoal",
      language: "en",
    });
  });

  it("falls back only an invalid writing font while preserving workspace settings", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("theme", "charcoal");
    storedValues.set("language", "ko");
    storedValues.set("writingFont", "display");

    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      theme: "charcoal",
      language: "ko",
      writingFont: "sans",
    });
  });

  it("falls back only an invalid document sort", async () => {
    // Given: a valid workspace with a damaged sort preference.
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("theme", "charcoal");
    storedValues.set("documentSort", "size");

    // When / Then: only the invalid field returns to its default.
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      theme: "charcoal",
      documentSort: "updated",
    });
  });

  it("falls back only an invalid document density", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("theme", "charcoal");
    storedValues.set("documentDensity", "tiny");

    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      theme: "charcoal",
      documentDensity: "full",
    });
  });

  it("falls back only an invalid pane flag", async () => {
    // Given: one malformed layout field and otherwise valid settings.
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("folderPaneOpen", "yes");
    storedValues.set("listPaneOpen", false);
    storedValues.set("language", "ko");

    // When / Then: the damaged flag falls back without resetting its siblings.
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      folderPaneOpen: true,
      listPaneOpen: false,
      language: "ko",
    });
  });

  it("falls back only the invalid tab session", async () => {
    // Given: the persisted tab session is malformed beside valid preferences.
    storedValues.set("docsRoot", "/memo/docs");
    storedValues.set("theme", "dark");
    storedValues.set("tabSessions", {
      intent: { paths: [42], activePath: null },
      docs: { paths: ["reference.md"], activePath: "reference.md" },
    });

    // When / Then: only the damaged Human session resets.
    await expect(loadSettings()).resolves.toMatchObject({
      docsRoot: "/memo/docs",
      theme: "dark",
      tabSessions: {
        intent: { paths: [], activePath: null },
        docs: {
          documents: [{ root: "/memo/docs", path: "reference.md" }],
          active: { root: "/memo/docs", path: "reference.md" },
        },
      },
    });
  });

  it("migrates a legacy AI session with its stored source root", async () => {
    storedValues.set("docsRoot", "/legacy/docs");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: { paths: ["a.md"], activePath: "a.md" },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoot: "/legacy/docs",
      tabSessions: {
        docs: {
          documents: [{ root: "/legacy/docs", path: "a.md" }],
          active: { root: "/legacy/docs", path: "a.md" },
        },
      },
    });
  });

  it("keeps cross-source AI references and derives browsing from the active tab", async () => {
    storedValues.set("docsRoot", "/docs/a");
    storedValues.set("tabSessions", {
      intent: { paths: ["purpose.md"], activePath: "purpose.md" },
      docs: {
        documents: [
          { root: "/docs/a", path: "a.md" },
          { root: "/outside", path: "other.md" },
          { root: "/docs/b", path: "folder/b.md" },
        ],
        active: { root: "/docs/b", path: "folder/b.md" },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoot: "/docs/b",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {
          documents: [
            { root: "/docs/a", path: "a.md" },
            { root: "/outside", path: "other.md" },
            { root: "/docs/b", path: "folder/b.md" },
          ],
          active: { root: "/docs/b", path: "folder/b.md" },
        },
      },
    });
  });

  it("drops only malformed AI document references", async () => {
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: {
        documents: [
          { root: "/docs/a", path: "a.md" },
          { root: 42, path: "bad.md" },
          { root: "/docs/b", path: "b.md" },
        ],
        active: { root: "/docs/b", path: "b.md" },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoot: "/docs/b",
      tabSessions: {
        docs: {
          documents: [
            { root: "/docs/a", path: "a.md" },
            { root: "/docs/b", path: "b.md" },
          ],
          active: { root: "/docs/b", path: "b.md" },
        },
      },
    });
  });

  it("drops non-canonical AI document paths before restoring a session", async () => {
    // Given: stored references containing every rejected relative-path shape.
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: {
        documents: [
          { root: "/docs", path: "visible.md" },
          { root: "/docs", path: "/absolute.md" },
          { root: "/docs", path: "" },
          { root: "/docs", path: "../parent.md" },
          { root: "/docs", path: "folder/../parent.md" },
          { root: "/docs", path: "./note.md" },
          { root: "/docs", path: ".hidden.md" },
          { root: "/docs", path: "folder/.hidden.md" },
          { root: "/docs", path: "folder/./note.md" },
          { root: "/docs", path: "note.txt" },
          { root: "/docs", path: "nested/visible.md" },
        ],
        active: { root: "/docs", path: ".hidden.md" },
      },
    });

    // When / Then: only canonical relative Markdown paths reach the session.
    await expect(loadSettings()).resolves.toMatchObject({
      docsRoot: "/docs",
      tabSessions: {
        docs: {
          documents: [
            { root: "/docs", path: "visible.md" },
            { root: "/docs", path: "nested/visible.md" },
          ],
          active: null,
        },
      },
    });
  });

  it("rejects a non-canonical AI document path before persistence", async () => {
    // Given: otherwise valid settings containing one hidden document path.
    const settings = {
      libraryRoot: "/memo/intent",
      docsRoot: "/memo/docs",
      activeSpace: "docs" as const,
      folderPaneOpen: true,
      listPaneOpen: true,
      documentDensity: "full" as const,
      documentSort: "updated" as const,
      theme: "light" as const,
      spacePalette: "classic" as const,
      language: "en" as const,
      writingFont: "sans" as const,
      tabSessions: {
        intent: { paths: [], activePath: null },
        docs: {
          documents: [{ root: "/memo/docs", path: ".hidden.md" }],
          active: null,
        },
      },
    };

    // When / Then: schema validation rejects before any store write occurs.
    await expect(saveSettings(settings)).rejects.toBeDefined();
    expect(storedValues.size).toBe(0);
  });

  it("falls back malformed AI fields without resetting Human settings", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("docsRoot", "/memo/docs");
    storedValues.set("theme", "charcoal");
    storedValues.set("tabSessions", {
      intent: { paths: ["purpose.md"], activePath: "purpose.md" },
      docs: { documents: [{ root: 42, path: "bad.md" }], active: null },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      docsRoot: "/memo/docs",
      theme: "charcoal",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: { documents: [], active: null },
      },
    });
  });

  it("cycles full to compact to focus and back to full", () => {
    // Given: each valid pane layout state.
    const full = { folderPaneOpen: true, listPaneOpen: true };
    const compact = { folderPaneOpen: false, listPaneOpen: true };
    const focus = { folderPaneOpen: false, listPaneOpen: false };

    // When / Then: one action advances to the next visible layout.
    expect(nextPaneLayout(full)).toEqual(compact);
    expect(nextPaneLayout(compact)).toEqual(focus);
    expect(nextPaneLayout(focus)).toEqual(full);
  });
});

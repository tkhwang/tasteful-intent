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

  it("defaults AI documents to folder-first Browse", async () => {
    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: [],
      docsBrowseRoot: null,
      docsSourceMode: "browse",
      docsPinnedRoots: [],
      docsPinnedRoot: null,
      tabSessions: {
        docsBrowse: {},
        docsPinned: {},
      },
    });
  });

  it("restores ordered Browse folder tabs and isolates root-local sessions", async () => {
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("docsBrowseRoots", ["/work/a", "", "/work/b", "/work/a"]);
    storedValues.set("docsBrowseRoot", "/work/b");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docsBrowse: {
        "/work/a": { paths: ["a.md"], activePath: "a.md" },
        "/work/b": { paths: ["b.md"], activePath: "b.md" },
        "/work/drop": { paths: ["drop.md"], activePath: "drop.md" },
      },
      docsPinned: {},
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: ["/work/a", "/work/b"],
      docsBrowseRoot: "/work/b",
      tabSessions: {
        docsBrowse: {
          "/work/a": { paths: ["a.md"], activePath: "a.md" },
          "/work/b": { paths: ["b.md"], activePath: "b.md" },
        },
      },
    });
  });

  it("promotes the current single folder-first Browse session", async () => {
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("docsRoot", "/work/current");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: { paths: ["current.md"], activePath: "current.md" },
      docsPinned: {},
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: ["/work/current"],
      docsBrowseRoot: "/work/current",
      tabSessions: {
        docsBrowse: {
          "/work/current": {
            paths: ["current.md"],
            activePath: "current.md",
          },
        },
      },
    });
  });

  it("resets legacy file-first AI references instead of promoting their root", async () => {
    storedValues.set("docsRoot", "/legacy/derived-root");
    storedValues.set("docsSourceMode", "open-files");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: {
        documents: [{ root: "/legacy/derived-root", path: "result.md" }],
        active: { root: "/legacy/derived-root", path: "result.md" },
      },
      docsPinned: {},
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: [],
      docsBrowseRoot: null,
      docsSourceMode: "browse",
      tabSessions: {
        docsBrowse: {},
      },
    });
  });

  it("starts without a Human or AI root when the store is empty", async () => {
    // Given: no persisted settings on first launch.
    // When / Then: loading settings must not invent either filesystem root.
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: null,
      docsBrowseRoots: [],
      docsBrowseRoot: null,
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
      docsBrowseRoots: [],
      docsBrowseRoot: null,
      docsSourceMode: "browse" as const,
      docsPinnedRoots: [],
      docsPinnedRoot: null,
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
        docsBrowse: {},
        docsPinned: {},
      },
    });
  });

  it("round-trips the independent Docs root and active space", async () => {
    await saveSettings({
      libraryRoot: "/memo/intent",
      docsBrowseRoots: ["/memo/docs"],
      docsBrowseRoot: "/memo/docs",
      docsSourceMode: "browse" as const,
      docsPinnedRoots: [],
      docsPinnedRoot: null,
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
        docsBrowse: {
          "/memo/docs": {
            paths: ["reference.md"],
            activePath: "reference.md",
          },
        },
        docsPinned: {},
      },
    });

    await expect(loadSettings()).resolves.toEqual({
      libraryRoot: "/memo/intent",
      docsBrowseRoots: ["/memo/docs"],
      docsBrowseRoot: "/memo/docs",
      docsSourceMode: "browse",
      docsPinnedRoots: [],
      docsPinnedRoot: null,
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
        docsBrowse: {
          "/memo/docs": {
            paths: ["reference.md"],
            activePath: "reference.md",
          },
        },
        docsPinned: {},
      },
    });
  });

  it("persists root-local AI document references", async () => {
    const docsSessionAfterModeChange = {
      paths: ["a.md"],
      activePath: "a.md",
    };

    // When: the complete settings snapshot is serialized to settings.json.
    await saveSettings({
      libraryRoot: "/memo/intent",
      docsBrowseRoots: ["/docs/a"],
      docsBrowseRoot: "/docs/a",
      docsSourceMode: "browse",
      docsPinnedRoots: [],
      docsPinnedRoot: null,
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
        docsBrowse: { "/docs/a": docsSessionAfterModeChange },
        docsPinned: {},
      },
    });

    // Then: raw storage contains only the canonical root-local tab structure.
    expect(storedValues.get("tabSessions")).toEqual({
      intent: { paths: [], activePath: null },
      docsBrowse: {
        "/docs/a": { paths: ["a.md"], activePath: "a.md" },
      },
      docsPinned: {},
    });
    expect([...storedValues.keys()]).not.toContain("mode");
  });

  it("falls back only the invalid theme while preserving valid workspace settings", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("docsRoot", "/memo/docs");
    storedValues.set("docsSourceMode", "browse");
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
      docsBrowseRoots: ["/memo/docs"],
      docsBrowseRoot: "/memo/docs",
      docsSourceMode: "browse",
      docsPinnedRoots: [],
      docsPinnedRoot: null,
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
        docsBrowse: {
          "/memo/docs": {
            paths: ["result.md"],
            activePath: "result.md",
          },
        },
        docsPinned: {},
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
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("theme", "dark");
    storedValues.set("tabSessions", {
      intent: { paths: [42], activePath: null },
      docs: { paths: ["reference.md"], activePath: "reference.md" },
    });

    // When / Then: only the damaged Human session resets.
    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: ["/memo/docs"],
      docsBrowseRoot: "/memo/docs",
      theme: "dark",
      tabSessions: {
        intent: { paths: [], activePath: null },
        docsBrowse: {
          "/memo/docs": {
            paths: ["reference.md"],
            activePath: "reference.md",
          },
        },
      },
    });
  });

  it("does not migrate a legacy root-local AI session without a folder-first mode", async () => {
    storedValues.set("docsRoot", "/legacy/docs");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: { paths: ["a.md"], activePath: "a.md" },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: [],
      docsBrowseRoot: null,
      tabSessions: {
        docsBrowse: {},
      },
    });
  });

  it("keeps one root-local Browse session", async () => {
    storedValues.set("docsRoot", "/docs/a");
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("tabSessions", {
      intent: { paths: ["purpose.md"], activePath: "purpose.md" },
      docs: {
        paths: ["a.md", "folder/b.md"],
        activePath: "folder/b.md",
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: ["/docs/a"],
      docsBrowseRoot: "/docs/a",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docsBrowse: {
          "/docs/a": {
            paths: ["a.md", "folder/b.md"],
            activePath: "folder/b.md",
          },
        },
      },
    });
  });

  it("drops only malformed root-local AI document references", async () => {
    storedValues.set("docsRoot", "/docs");
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: {
        paths: ["a.md", 42, "b.md"],
        activePath: "b.md",
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: ["/docs"],
      docsBrowseRoot: "/docs",
      tabSessions: {
        docsBrowse: {
          "/docs": { paths: ["a.md", "b.md"], activePath: "b.md" },
        },
      },
    });
  });

  it("drops non-canonical AI document paths before restoring a session", async () => {
    // Given: stored references containing every rejected relative-path shape.
    storedValues.set("docsRoot", "/docs");
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: {
        paths: [
          "visible.md",
          "/absolute.md",
          "",
          "../parent.md",
          "folder/../parent.md",
          "./note.md",
          ".hidden.md",
          "folder/.hidden.md",
          "folder/./note.md",
          "note.txt",
          "nested/visible.md",
        ],
        activePath: ".hidden.md",
      },
    });

    // When / Then: only canonical relative Markdown paths reach the session.
    await expect(loadSettings()).resolves.toMatchObject({
      docsBrowseRoots: ["/docs"],
      docsBrowseRoot: "/docs",
      tabSessions: {
        docsBrowse: {
          "/docs": {
            paths: ["visible.md", "nested/visible.md"],
            activePath: null,
          },
        },
      },
    });
  });

  it("rejects a non-canonical AI document path before persistence", async () => {
    // Given: otherwise valid settings containing one hidden document path.
    const settings = {
      libraryRoot: "/memo/intent",
      docsBrowseRoots: ["/memo/docs"],
      docsBrowseRoot: "/memo/docs",
      docsSourceMode: "browse" as const,
      docsPinnedRoots: [],
      docsPinnedRoot: null,
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
        docsBrowse: {
          "/memo/docs": { paths: [".hidden.md"], activePath: null },
        },
        docsPinned: {},
      },
    };

    // When / Then: schema validation rejects before any store write occurs.
    await expect(saveSettings(settings)).rejects.toBeDefined();
    expect(storedValues.size).toBe(0);
  });

  it("falls back malformed AI fields without resetting Human settings", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("docsRoot", "/memo/docs");
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("theme", "charcoal");
    storedValues.set("tabSessions", {
      intent: { paths: ["purpose.md"], activePath: "purpose.md" },
      docs: { documents: [{ root: 42, path: "bad.md" }], active: null },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      docsBrowseRoots: ["/memo/docs"],
      docsBrowseRoot: "/memo/docs",
      theme: "charcoal",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docsBrowse: {
          "/memo/docs": { paths: [], activePath: null },
        },
      },
    });
  });

  it("defaults AI documents to Browse with no pinned folders", async () => {
    // Given: no persisted settings.
    // When: settings are loaded for the first time.
    const settings = await loadSettings();

    // Then: Browse is the default and Pinned starts empty.
    expect(settings).toMatchObject({
      docsSourceMode: "browse",
      docsPinnedRoots: [],
      docsPinnedRoot: null,
      tabSessions: {
        docsPinned: {},
      },
    });
  });

  it("round-trips Browse and root-local Pinned sessions independently", async () => {
    // Given: both AI source modes have independent sessions.
    const settings = await loadSettings();

    // When: two pinned roots and their sessions are persisted.
    await saveSettings({
      ...settings,
      docsSourceMode: "pinned",
      docsPinnedRoots: [
        { root: "/work/task-a", label: "T" },
        { root: "/work/task-b", label: "T" },
      ],
      docsPinnedRoot: "/work/task-b",
      docsBrowseRoots: ["/tmp"],
      docsBrowseRoot: "/tmp",
      tabSessions: {
        intent: { paths: [], activePath: null },
        docsBrowse: {
          "/tmp": { paths: ["one.md"], activePath: "one.md" },
        },
        docsPinned: {
          "/work/task-a": {
            paths: ["docs/a.md"],
            activePath: "docs/a.md",
          },
          "/work/task-b": {
            paths: ["docs/b.md"],
            activePath: "docs/b.md",
          },
        },
      },
    });

    // Then: neither mode overwrites the other mode's references.
    await expect(loadSettings()).resolves.toMatchObject({
      docsSourceMode: "pinned",
      docsPinnedRoots: [
        { root: "/work/task-a", label: "T" },
        { root: "/work/task-b", label: "T" },
      ],
      docsPinnedRoot: "/work/task-b",
      tabSessions: {
        docsBrowse: {
          "/tmp": { paths: ["one.md"], activePath: "one.md" },
        },
        docsPinned: {
          "/work/task-a": {
            paths: ["docs/a.md"],
            activePath: "docs/a.md",
          },
          "/work/task-b": {
            paths: ["docs/b.md"],
            activePath: "docs/b.md",
          },
        },
      },
    });
  });

  it("sanitizes Pinned Folder fields without discarding surviving sessions", async () => {
    // Given: malformed mode, duplicate roots, an unpinned session, and invalid paths.
    storedValues.set("docsSourceMode", "unknown");
    storedValues.set("docsRoots", ["/work/a", "", "/work/a", "/work/b"]);
    storedValues.set("docsPinnedRoot", "/not-pinned");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: { paths: [], activePath: null },
      docsPinned: {
        "/work/a": {
          paths: [
            "good.md",
            "nested/good.md",
            "good.md",
            "../bad.md",
            ".hidden.md",
            "bad.txt",
          ],
          activePath: "missing.md",
        },
        "/work/b": {
          paths: ["docs/b.md"],
          activePath: "docs/b.md",
        },
        "/not-pinned": {
          paths: ["drop.md"],
          activePath: "drop.md",
        },
      },
    });

    // When / Then: valid roots and sessions survive while invalid members are isolated.
    await expect(loadSettings()).resolves.toMatchObject({
      docsSourceMode: "browse",
      docsPinnedRoots: [
        { root: "/work/a", label: "a" },
        { root: "/work/b", label: "b" },
      ],
      docsPinnedRoot: null,
      tabSessions: {
        docsPinned: {
          "/work/a": {
            paths: ["good.md", "nested/good.md"],
            activePath: null,
          },
          "/work/b": {
            paths: ["docs/b.md"],
            activePath: "docs/b.md",
          },
        },
      },
    });
  });

  it("keeps valid current pinned roots when a sibling entry is malformed", async () => {
    storedValues.set("docsPinnedRoots", [
      { root: "", label: "X" },
      { root: "/work/current", label: "CU" },
    ]);
    storedValues.set("docsRoots", ["/work/legacy"]);
    storedValues.set("docsPinnedRoot", "/work/current");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docs: { paths: [], activePath: null },
      docsPinned: {
        "/work/current": {
          paths: ["docs/current.md"],
          activePath: "docs/current.md",
        },
        "/work/legacy": {
          paths: ["docs/legacy.md"],
          activePath: "docs/legacy.md",
        },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsPinnedRoots: [{ root: "/work/current", label: "CU" }],
      docsPinnedRoot: "/work/current",
      tabSessions: {
        docsPinned: {
          "/work/current": {
            paths: ["docs/current.md"],
            activePath: "docs/current.md",
          },
        },
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

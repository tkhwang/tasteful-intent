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

    delete(key: string) {
      storedValues.delete(key);
      return Promise.resolve(true);
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

  it("defaults AI documents to one empty folder-tab workspace", async () => {
    await expect(loadSettings()).resolves.toMatchObject({
      settingsSchemaVersion: 2,
      docsRoots: [],
      docsRoot: null,
      tabSessions: { docs: {} },
    });
  });

  it("migrates current Browse and Pinned roots into one pinned-first list", async () => {
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("docsPinnedRoots", [
      { root: "/work/shared", label: "S" },
      { root: "/work/pinned", label: "P" },
    ]);
    storedValues.set("docsPinnedRoot", "/work/pinned");
    storedValues.set("docsBrowseRoots", [
      "/work/browse",
      "/work/shared",
      "/work/second",
    ]);
    storedValues.set("docsBrowseRoot", "/work/browse");
    storedValues.set("tabSessions", {
      intent: { paths: [], activePath: null },
      docsPinned: {
        "/work/shared": {
          paths: ["pinned.md", "shared.md"],
          activePath: "pinned.md",
        },
      },
      docsBrowse: {
        "/work/shared": {
          paths: ["browse.md", "shared.md"],
          activePath: "browse.md",
        },
        "/work/browse": {
          paths: ["browse-only.md"],
          activePath: "browse-only.md",
        },
        "/orphan": { paths: ["drop.md"], activePath: "drop.md" },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [
        { root: "/work/shared", label: "S" },
        { root: "/work/pinned", label: "P" },
        { root: "/work/browse", label: null },
        { root: "/work/second", label: null },
      ],
      docsRoot: "/work/browse",
      tabSessions: {
        docs: {
          "/work/shared": {
            paths: ["browse.md", "shared.md", "pinned.md"],
            activePath: "browse.md",
          },
          "/work/browse": {
            paths: ["browse-only.md"],
            activePath: "browse-only.md",
          },
        },
      },
    });
  });

  it("prefers Pinned session paths and active root for the last Pinned mode", async () => {
    storedValues.set("docsSourceMode", "pinned");
    storedValues.set("docsPinnedRoots", [{ root: "/work/shared", label: "S" }]);
    storedValues.set("docsPinnedRoot", "/work/shared");
    storedValues.set("docsBrowseRoots", ["/work/shared"]);
    storedValues.set("docsBrowseRoot", "/work/shared");
    storedValues.set("tabSessions", {
      docsPinned: {
        "/work/shared": {
          paths: ["pinned.md"],
          activePath: "pinned.md",
        },
      },
      docsBrowse: {
        "/work/shared": {
          paths: ["browse.md"],
          activePath: "browse.md",
        },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoot: "/work/shared",
      tabSessions: {
        docs: {
          "/work/shared": {
            paths: ["pinned.md", "browse.md"],
            activePath: "pinned.md",
          },
        },
      },
    });
  });

  it("uses Browse as the preferred session when the legacy mode is invalid", async () => {
    storedValues.set("docsSourceMode", "unknown");
    storedValues.set("docsPinnedRoots", [{ root: "/work/shared", label: "S" }]);
    storedValues.set("docsBrowseRoots", ["/work/shared"]);
    storedValues.set("docsBrowseRoot", "/work/shared");
    storedValues.set("tabSessions", {
      docsPinned: {
        "/work/shared": {
          paths: ["pinned.md"],
          activePath: "pinned.md",
        },
      },
      docsBrowse: {
        "/work/shared": {
          paths: ["browse.md"],
          activePath: "browse.md",
        },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoot: "/work/shared",
      tabSessions: {
        docs: {
          "/work/shared": {
            paths: ["browse.md", "pinned.md"],
            activePath: "browse.md",
          },
        },
      },
    });
  });

  it("promotes legacy string docsRoots and one docs session", async () => {
    storedValues.set("docsRoots", ["/legacy/a", "", "/legacy/a", "/legacy/b"]);
    storedValues.set("docsRoot", "/legacy/b");
    storedValues.set("docsSourceMode", "pinned-folders");
    storedValues.set("tabSessions", {
      docs: { paths: ["legacy.md"], activePath: "legacy.md" },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [
        { root: "/legacy/a", label: "a" },
        { root: "/legacy/b", label: "b" },
      ],
      docsRoot: "/legacy/b",
      tabSessions: {
        docs: {
          "/legacy/b": {
            paths: ["legacy.md"],
            activePath: "legacy.md",
          },
        },
      },
    });
  });

  it("promotes a single legacy folder-first docsRoot", async () => {
    storedValues.set("docsRoot", "/work/current");
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("tabSessions", {
      docs: { paths: ["current.md"], activePath: "current.md" },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [{ root: "/work/current", label: null }],
      docsRoot: "/work/current",
      tabSessions: {
        docs: {
          "/work/current": {
            paths: ["current.md"],
            activePath: "current.md",
          },
        },
      },
    });
  });

  it("does not promote a legacy file-first AI root", async () => {
    storedValues.set("docsRoot", "/legacy/derived-root");
    storedValues.set("docsSourceMode", "open-files");
    storedValues.set("tabSessions", {
      docs: {
        documents: [{ root: "/legacy/derived-root", path: "result.md" }],
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [],
      docsRoot: null,
      tabSessions: { docs: {} },
    });
  });

  it("normalizes version-2 labels, order, active root, and orphan sessions", async () => {
    storedValues.set("settingsSchemaVersion", 2);
    storedValues.set("docsRoots", [
      { root: "/work/a", label: null },
      { root: "/work/b", label: "TOO" },
      { root: "/work/c", label: "C" },
      { root: "/work/d", label: null },
      { root: "/work/a", label: "A" },
    ]);
    storedValues.set("docsRoot", "/missing");
    storedValues.set("tabSessions", {
      docs: {
        "/work/a": { paths: ["a.md"], activePath: "a.md" },
        "/work/c": { paths: ["c.md"], activePath: "c.md" },
        "/orphan": { paths: ["drop.md"], activePath: "drop.md" },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [
        { root: "/work/a", label: "A" },
        { root: "/work/c", label: "C" },
        { root: "/work/b", label: null },
        { root: "/work/d", label: null },
      ],
      docsRoot: "/work/a",
      tabSessions: {
        docs: {
          "/work/c": { paths: ["c.md"], activePath: "c.md" },
          "/work/a": { paths: ["a.md"], activePath: "a.md" },
        },
      },
    });
  });

  it("lets current fields override same-name leapfrog fields", async () => {
    storedValues.set("docsBrowseRoots", []);
    storedValues.set("docsPinnedRoots", []);
    storedValues.set("docsRoots", ["/legacy/drop"]);
    storedValues.set("docsRoot", "/legacy/drop");

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [],
      docsRoot: null,
      tabSessions: { docs: {} },
    });
  });

  it("deletes retired source-mode keys after saving version 2", async () => {
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("docsBrowseRoots", ["/work/a"]);
    storedValues.set("docsBrowseRoot", "/work/a");
    storedValues.set("docsPinnedRoots", []);
    storedValues.set("docsPinnedRoot", null);

    await saveSettings(await loadSettings());

    for (const key of [
      "docsSourceMode",
      "docsBrowseRoots",
      "docsBrowseRoot",
      "docsPinnedRoots",
      "docsPinnedRoot",
    ]) {
      expect(storedValues.has(key)).toBe(false);
    }
    expect(storedValues.get("settingsSchemaVersion")).toBe(2);
  });

  it("starts without a Human or AI root when the store is empty", async () => {
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: null,
      docsRoots: [],
      docsRoot: null,
      documentDensity: "full",
      documentSort: "updated",
      language: "en",
      spacePalette: "classic",
      writingFont: "sans",
    });
  });

  it("round-trips the selected space palette", async () => {
    const settings = await loadSettings();
    await saveSettings({ ...settings, spacePalette: "plum-moss" });
    await expect(loadSettings()).resolves.toMatchObject({
      spacePalette: "plum-moss",
    });
  });

  it("falls back only an invalid space palette", async () => {
    storedValues.set("spacePalette", "invalid");
    storedValues.set("theme", "dark");
    await expect(loadSettings()).resolves.toMatchObject({
      spacePalette: "classic",
      theme: "dark",
    });
  });

  it("loads a v0.1 store into the Intent space without moving its library", async () => {
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("activeSpace", "invalid");
    storedValues.set("folderPaneOpen", false);
    storedValues.set("listPaneOpen", true);

    await expect(loadSettings()).resolves.toEqual({
      settingsSchemaVersion: 2,
      libraryRoot: "/memo/intent",
      docsRoots: [],
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
        docs: {},
      },
    });
  });

  it("round-trips the independent Docs root and active space", async () => {
    const settings = await loadSettings();
    await saveSettings({
      ...settings,
      libraryRoot: "/memo/intent",
      docsRoots: [{ root: "/memo/docs", label: null }],
      docsRoot: "/memo/docs",
      activeSpace: "docs",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {
          "/memo/docs": { paths: ["result.md"], activePath: "result.md" },
        },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      docsRoots: [{ root: "/memo/docs", label: null }],
      docsRoot: "/memo/docs",
      activeSpace: "docs",
      tabSessions: {
        docs: {
          "/memo/docs": { paths: ["result.md"], activePath: "result.md" },
        },
      },
    });
  });

  it("persists root-local AI document references", async () => {
    const settings = await loadSettings();
    await saveSettings({
      ...settings,
      docsRoots: [{ root: "/docs/a", label: null }],
      docsRoot: "/docs/a",
      tabSessions: {
        ...settings.tabSessions,
        docs: {
          "/docs/a": {
            paths: ["one.md", "nested/two.md"],
            activePath: "nested/two.md",
          },
        },
      },
    });

    expect(storedValues.get("tabSessions")).toEqual({
      intent: { paths: [], activePath: null },
      docs: {
        "/docs/a": {
          paths: ["one.md", "nested/two.md"],
          activePath: "nested/two.md",
        },
      },
    });
  });

  it("falls back only the invalid theme while preserving valid workspace settings", async () => {
    storedValues.set("settingsSchemaVersion", 2);
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("docsRoots", [{ root: "/memo/docs", label: null }]);
    storedValues.set("docsRoot", "/memo/docs");
    storedValues.set("activeSpace", "docs");
    storedValues.set("theme", "invalid");
    storedValues.set("language", "ko");
    storedValues.set("tabSessions", {
      intent: { paths: ["purpose.md"], activePath: "purpose.md" },
      docs: {
        "/memo/docs": { paths: ["result.md"], activePath: "result.md" },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      docsRoot: "/memo/docs",
      activeSpace: "docs",
      theme: "light",
      language: "ko",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {
          "/memo/docs": { paths: ["result.md"], activePath: "result.md" },
        },
      },
    });
  });

  it("falls back only an invalid language while preserving the selected theme", async () => {
    storedValues.set("language", "invalid");
    storedValues.set("theme", "dark");
    await expect(loadSettings()).resolves.toMatchObject({
      language: "en",
      theme: "dark",
    });
  });

  it("falls back only an invalid writing font while preserving workspace settings", async () => {
    storedValues.set("writingFont", "invalid");
    storedValues.set("libraryRoot", "/memo/intent");
    await expect(loadSettings()).resolves.toMatchObject({
      writingFont: "sans",
      libraryRoot: "/memo/intent",
    });
  });

  it("falls back only an invalid document sort", async () => {
    storedValues.set("documentSort", "invalid");
    storedValues.set("documentDensity", "simple");
    await expect(loadSettings()).resolves.toMatchObject({
      documentSort: "updated",
      documentDensity: "simple",
    });
  });

  it("falls back only an invalid document density", async () => {
    storedValues.set("documentDensity", "invalid");
    storedValues.set("documentSort", "title");
    await expect(loadSettings()).resolves.toMatchObject({
      documentDensity: "full",
      documentSort: "title",
    });
  });

  it("falls back only an invalid pane flag", async () => {
    storedValues.set("folderPaneOpen", "invalid");
    storedValues.set("listPaneOpen", false);
    await expect(loadSettings()).resolves.toMatchObject({
      folderPaneOpen: true,
      listPaneOpen: false,
    });
  });

  it("falls back only the invalid Human tab session", async () => {
    storedValues.set("settingsSchemaVersion", 2);
    storedValues.set("docsRoots", [{ root: "/memo/docs", label: null }]);
    storedValues.set("docsRoot", "/memo/docs");
    storedValues.set("tabSessions", {
      intent: { paths: "bad", activePath: null },
      docs: {
        "/memo/docs": {
          paths: ["reference.md"],
          activePath: "reference.md",
        },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      tabSessions: {
        intent: { paths: [], activePath: null },
        docs: {
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
      docs: { paths: ["legacy.md"], activePath: "legacy.md" },
    });
    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [],
      docsRoot: null,
      tabSessions: { docs: {} },
    });
  });

  it("keeps one root-local AI session alongside the Human session", async () => {
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
      docsRoots: [{ root: "/docs/a", label: null }],
      docsRoot: "/docs/a",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {
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
      docs: {
        paths: ["a.md", 17, "b.md", "a.md"],
        activePath: "b.md",
      },
    });
    await expect(loadSettings()).resolves.toMatchObject({
      tabSessions: {
        docs: {
          "/docs": { paths: ["a.md", "b.md"], activePath: "b.md" },
        },
      },
    });
  });

  it("drops non-canonical AI document paths before restoring a session", async () => {
    storedValues.set("docsRoot", "/docs");
    storedValues.set("docsSourceMode", "browse");
    storedValues.set("tabSessions", {
      docs: {
        paths: [
          "visible.md",
          "nested/visible.md",
          "/absolute.md",
          "../outside.md",
          ".hidden.md",
          "folder/.hidden.md",
          "note.txt",
        ],
        activePath: "../outside.md",
      },
    });
    await expect(loadSettings()).resolves.toMatchObject({
      tabSessions: {
        docs: {
          "/docs": {
            paths: ["visible.md", "nested/visible.md"],
            activePath: null,
          },
        },
      },
    });
  });

  it("rejects a non-canonical AI document path before persistence", async () => {
    const settings = await loadSettings();
    await expect(
      saveSettings({
        ...settings,
        docsRoots: [{ root: "/memo/docs", label: null }],
        docsRoot: "/memo/docs",
        tabSessions: {
          ...settings.tabSessions,
          docs: {
            "/memo/docs": {
              paths: ["../outside.md"],
              activePath: "../outside.md",
            },
          },
        },
      }),
    ).rejects.toThrow();
  });

  it("falls back malformed AI fields without resetting Human settings", async () => {
    storedValues.set("settingsSchemaVersion", 2);
    storedValues.set("libraryRoot", "/memo/intent");
    storedValues.set("docsRoots", [null, { root: "", label: "X" }]);
    storedValues.set("docsRoot", "/missing");
    storedValues.set("tabSessions", {
      intent: { paths: ["purpose.md"], activePath: "purpose.md" },
      docs: { "/missing": { paths: ["drop.md"], activePath: "drop.md" } },
    });
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: "/memo/intent",
      docsRoots: [],
      docsRoot: null,
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: {},
      },
    });
  });

  it("round-trips pinned and unpinned root-local sessions together", async () => {
    const settings = await loadSettings();
    await saveSettings({
      ...settings,
      docsRoots: [
        { root: "/work/task-a", label: "T" },
        { root: "/work/task-b", label: "T" },
        { root: "/tmp", label: null },
      ],
      docsRoot: "/work/task-b",
      tabSessions: {
        intent: { paths: [], activePath: null },
        docs: {
          "/tmp": { paths: ["one.md"], activePath: "one.md" },
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

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [
        { root: "/work/task-a", label: "T" },
        { root: "/work/task-b", label: "T" },
        { root: "/tmp", label: null },
      ],
      docsRoot: "/work/task-b",
      tabSessions: {
        docs: {
          "/tmp": { paths: ["one.md"], activePath: "one.md" },
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

  it("prefers pinned metadata from a later duplicate version-2 root", async () => {
    storedValues.set("settingsSchemaVersion", 2);
    storedValues.set("docsRoots", [
      { root: "/work/shared", label: null },
      { root: "/work/shared", label: "S" },
    ]);
    storedValues.set("docsRoot", "/work/shared");

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [{ root: "/work/shared", label: "S" }],
      docsRoot: "/work/shared",
    });
  });

  it("sanitizes current Pinned fields without discarding surviving sessions", async () => {
    storedValues.set("docsSourceMode", "unknown");
    storedValues.set("docsPinnedRoots", [
      { root: "/work/a", label: "a" },
      { root: "", label: "X" },
      { root: "/work/a", label: "AA" },
      { root: "/work/b", label: "TOO" },
    ]);
    storedValues.set("docsPinnedRoot", "/not-pinned");
    storedValues.set("tabSessions", {
      docsPinned: {
        "/work/a": {
          paths: ["good.md", "nested/good.md", "../bad.md"],
          activePath: "missing.md",
        },
        "/work/b": {
          paths: ["docs/b.md"],
          activePath: "docs/b.md",
        },
      },
    });

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [
        { root: "/work/a", label: "a" },
        { root: "/work/b", label: null },
      ],
      docsRoot: "/work/a",
      tabSessions: {
        docs: {
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
    storedValues.set("docsSourceMode", "pinned");
    storedValues.set("tabSessions", {
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
      docsRoots: [{ root: "/work/current", label: "CU" }],
      docsRoot: "/work/current",
      tabSessions: {
        docs: {
          "/work/current": {
            paths: ["docs/current.md"],
            activePath: "docs/current.md",
          },
        },
      },
    });
  });

  it("orders valid current pins before labels normalized to unpinned", async () => {
    storedValues.set("docsPinnedRoots", [
      { root: "/work/invalid-label", label: "LONG" },
      { root: "/work/valid", label: "V" },
    ]);
    storedValues.set("docsPinnedRoot", "/work/valid");
    storedValues.set("docsSourceMode", "pinned");

    await expect(loadSettings()).resolves.toMatchObject({
      docsRoots: [
        { root: "/work/valid", label: "V" },
        { root: "/work/invalid-label", label: null },
      ],
      docsRoot: "/work/valid",
    });
  });

  it("rejects non-pinned-first version-2 persistence", async () => {
    const settings = await loadSettings();
    await expect(
      saveSettings({
        ...settings,
        docsRoots: [
          { root: "/work/a", label: null },
          { root: "/work/b", label: "B" },
        ],
        docsRoot: "/work/a",
      }),
    ).rejects.toThrow();
  });

  it("cycles full to compact to focus and back to full", () => {
    const full = { folderPaneOpen: true, listPaneOpen: true };
    const compact = { folderPaneOpen: false, listPaneOpen: true };
    const focus = { folderPaneOpen: false, listPaneOpen: false };

    expect(nextPaneLayout(full)).toEqual(compact);
    expect(nextPaneLayout(compact)).toEqual(focus);
    expect(nextPaneLayout(focus)).toEqual(full);
  });
});

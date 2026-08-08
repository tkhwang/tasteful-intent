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
  beforeEach(() => storedValues.clear());

  it("starts without a Human or AI root when the store is empty", async () => {
    // Given: no persisted settings on first launch.
    // When / Then: loading settings must not invent either filesystem root.
    await expect(loadSettings()).resolves.toMatchObject({
      libraryRoot: null,
      docsRoot: null,
      language: "en",
      writingFont: "sans",
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
      theme: "light",
      language: "en",
      writingFont: "sans",
      tabSessions: {
        intent: { paths: [], activePath: null },
        docs: { paths: [], activePath: null },
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
      theme: "system",
      language: "ko",
      writingFont: "serif",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: { paths: ["reference.md"], activePath: "reference.md" },
      },
    });

    await expect(loadSettings()).resolves.toEqual({
      libraryRoot: "/memo/intent",
      docsRoot: "/memo/docs",
      activeSpace: "docs",
      folderPaneOpen: true,
      listPaneOpen: false,
      theme: "system",
      language: "ko",
      writingFont: "serif",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: { paths: ["reference.md"], activePath: "reference.md" },
      },
    });
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
      theme: "light",
      language: "ko",
      writingFont: "sans",
      tabSessions: {
        intent: { paths: ["purpose.md"], activePath: "purpose.md" },
        docs: { paths: ["result.md"], activePath: "result.md" },
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

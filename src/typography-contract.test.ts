import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as {
  readonly dependencies?: Readonly<Record<string, string>>;
};
const indexCss = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const fontsCssUrl = new URL("./fonts.css", import.meta.url);
const fontsCss = readFileSync(fontsCssUrl, "utf8");
const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const noticeUrl = new URL("../THIRD_PARTY_NOTICES.md", import.meta.url);
const tauriConfig = JSON.parse(
  readFileSync(
    new URL("../src-tauri/tauri.conf.json", import.meta.url),
    "utf8",
  ),
) as {
  readonly bundle?: {
    readonly resources?: Readonly<Record<string, string>>;
  };
};

describe("bundled typography contract", () => {
  it("resolves every declared WOFF2 asset", () => {
    const fontAssetPaths = Array.from(
      fontsCss.matchAll(/url\(([^)]+)\)/g),
      (match) => match.at(1),
    )
      .filter((path): path is string => path !== undefined)
      .map((path) => path.trim().replace(/^["']|["']$/g, ""));

    expect(fontAssetPaths.length).toBeGreaterThan(0);
    for (const fontAssetPath of fontAssetPaths) {
      expect(fontAssetPath).toMatch(/\.woff2$/);
      expect(existsSync(new URL(fontAssetPath, fontsCssUrl))).toBe(true);
    }
  });

  it("bundles the Korean UI and writing families without replacing monospace", () => {
    expect(packageJson.dependencies?.["@fontsource/ibm-plex-sans-kr"]).toBe(
      "5.3.0",
    );
    expect(packageJson.dependencies?.["@fontsource/hahmlet"]).toBe("5.3.0");
    expect(
      packageJson.dependencies?.["@fontsource/ibm-plex-mono"],
    ).toBeUndefined();
    expect(mainSource).toContain('import "@/fonts.css";');
    expect(indexCss).toMatch(/--ui-font:\s*"IBM Plex Sans KR"/);
    expect(indexCss).toMatch(/--writing-sans-font:\s*"IBM Plex Sans KR"/);
    expect(indexCss).toMatch(/--writing-serif-font:\s*"Hahmlet"/);
    expect(indexCss).toContain("font-family: var(--ui-font)");
    expect(indexCss).toContain("--writing-font: var(--writing-sans-font)");
    expect(indexCss).toContain("--writing-font: var(--writing-serif-font)");
    expect(indexCss).toContain(
      '--fixed-font: "SFMono-Regular", "Cascadia Code", monospace',
    );
    expect(indexCss).toContain("font-synthesis: style;");
    expect(existsSync(noticeUrl)).toBe(true);
    if (existsSync(noticeUrl)) {
      const notice = readFileSync(noticeUrl, "utf8");
      expect(notice).toContain("IBM Plex Sans KR");
      expect(notice).toContain("Hahmlet");
      expect(notice).toContain("SIL OPEN FONT LICENSE Version 1.1");
    }
    expect(tauriConfig.bundle?.resources).toMatchObject({
      "../THIRD_PARTY_NOTICES.md": "THIRD_PARTY_NOTICES.md",
    });
  });
});

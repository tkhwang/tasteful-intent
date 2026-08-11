import { describe, expect, it } from "vitest";
import { getMessages } from "./i18n";

describe("i18n", () => {
  it("provides English and Korean application copy", () => {
    const english = getMessages("en");
    const korean = getMessages("ko");

    expect(english.settings.title).toBe("Settings");
    expect(korean.settings.title).toBe("설정");
    expect(english.editor.body).toBe("Markdown body");
    expect(korean.editor.body).toBe("Markdown 본문");
    expect(english.settings.themeLabels.charcoal).toBe("Two-Tone");
    expect(korean.settings.themeLabels).toEqual({
      light: "라이트",
      charcoal: "투톤",
      dark: "다크",
      system: "시스템",
    });
    expect(english.settings.spacePalette).toBe("Human & AI colors");
    expect(korean.settings.spacePalette).toBe("Human·AI 색상");
    expect(english.settings.spacePaletteLabels["plum-moss"]).toBe(
      "Plum & Moss",
    );
    expect(korean.settings.spacePaletteLabels["mono-duo"]).toBe("모노 듀오");
    expect(korean.settings.languageTitle).toBe("앱 언어를 선택하세요");
    expect(korean.app.folders).toBe("폴더");
    expect(english.app.newIntent).toBe("New Intent");
    expect(korean.app.newIntent).toBe("새로운 의도");
    expect(english.app.newCollection).toBe("New Collection");
    expect(korean.app.newCollection).toBe("새 모음");
    expect(korean.app.notes(2)).toBe("메모 2개");
    expect(english.onboarding.step(2, 3)).toBe("Step 2 of 3");
    expect(korean.onboarding.step(2, 3)).toBe("3단계 중 2단계");
    expect(english.app.refreshList).toBe("Refresh document list");
    expect(english.app.reloadCurrentDocument).toBe("Reload current document");
    expect(korean.app.reloadCurrentDocument).toBe("현재 문서 다시 불러오기");
    expect(english.app.exportPdf).toBe("Export current document as PDF");
    expect(korean.app.exportPdf).toBe("현재 문서를 PDF로 내보내기");
    expect(korean.app.sortTitle).toContain("제목");
    expect(english.space.libraryLabel).toBe("Tasteful Intent Library");
    expect(korean.space.libraryLabel).toBe("Tasteful Intent 라이브러리");
    expect(english.docsRoots.groupLabel).toBe("Currently open AI documents");
    expect(english.docsRoots.menuLabel).toBe("Currently open AI paths");
    expect(english.app.chooseDocsRoot).toBe("Open AI document");
    expect(korean.menu).toEqual({
      rename: "이름 변경…",
      move: "이동…",
      trash: "휴지통으로 이동",
    });
  });

  it("keeps user paths intact in localized accessible copy", () => {
    const path = "/Users/tommy/의도";

    expect(getMessages("en").space.rootAction(path)).toContain(path);
    expect(getMessages("ko").space.rootAction(path)).toContain(path);
  });
});

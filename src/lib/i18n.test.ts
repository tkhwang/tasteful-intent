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
    expect(english.space.libraryLabel).toBe("Tasteful Intents");
    expect(korean.space.libraryLabel).toBe("Tasteful Intents");
    expect(english.app.chooseDocsRoot).toBe("Open AI folder");
    expect(english.docsRoots.pin).toBe("Pin");
    expect(korean.docsRoots.unpin).toBe("고정 해제");
    expect(english.docsRoots.refresh).toBe("Refresh");
    expect(korean.docsRoots.unavailable).toBe("사용할 수 없음");
    expect(korean.docsRoots.actions("문서", "/work/docs")).toBe(
      "문서 작업 열기: /work/docs",
    );
    expect(korean.docsRoots.menu("문서", "/work/docs")).toBe(
      "문서 작업: /work/docs",
    );
    expect(korean.app.docsTitle).toBe(
      "내가 보려고 하는 AI 문서 폴더를 선택하세요",
    );
    expect(korean.app.docsBody).toBe("");
    expect(korean.docsRoots.emptyTitle).toBe(
      "내가 보려고 하는 AI 문서 폴더를 선택하세요.",
    );
    expect(korean.docsRoots.emptyBody).toContain("폴더 탭");
    expect(korean.docsRoots.editLabel).toBe("Label 수정");
    expect(korean.docsRoots.labelTitle).toBe("폴더 Label");
    expect(korean.docsRoots.saveLabel).toBe("Label 저장");
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
    expect(getMessages("en").docsRoots.actions("의도", path)).toContain(path);
    expect(
      getMessages("ko").docsRoots.selectPinned("의", "의도", path, true),
    ).toContain(path);
  });
});

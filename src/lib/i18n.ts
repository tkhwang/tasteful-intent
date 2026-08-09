import type { ReactNode } from "react";
import { createContext, createElement, useContext } from "react";
import type { Language, Theme } from "../types/library";

export type Messages = {
  readonly locale: string;
  readonly onboarding: {
    readonly step: (current: number, total: number) => string;
    readonly languageTitle: string;
    readonly languageBody: string;
    readonly themeTitle: string;
    readonly themeBody: string;
    readonly humanTitle: string;
    readonly humanBody: string;
    readonly back: string;
    readonly continue: string;
    readonly skip: string;
  };
  readonly settings: {
    readonly title: string;
    readonly navigationLabel: string;
    readonly appearance: string;
    readonly appearanceTitle: string;
    readonly typography: string;
    readonly typographyTitle: string;
    readonly language: string;
    readonly languageTitle: string;
    readonly theme: string;
    readonly themeLabels: Record<Theme, string>;
    readonly writingFont: string;
    readonly sansSerif: string;
    readonly sansSerifNote: string;
    readonly serif: string;
    readonly serifNote: string;
    readonly preview: string;
    readonly fontPreviewTitle: string;
    readonly fontPreviewBody: string;
    readonly fontHelp: string;
    readonly appLanguage: string;
    readonly english: string;
    readonly englishNote: string;
    readonly korean: string;
    readonly koreanNote: string;
    readonly languageHelp: string;
    readonly close: string;
  };
  readonly space: {
    readonly switchTo: (label: string) => string;
    readonly groupLabel: string;
    readonly libraryLabel: string;
    readonly rootAction: (root: string) => string;
  };
  readonly docsRoots: {
    readonly groupLabel: string;
    readonly menuLabel: string;
    readonly menuItem: (label: string, folder: string, path: string) => string;
    readonly shortcut: (label: string, path: string) => string;
    readonly toggle: (label: string, path: string) => string;
  };
  readonly app: {
    readonly loadError: string;
    readonly loading: string;
    readonly chooseIntentRoot: string;
    readonly chooseDocsRoot: string;
    readonly welcomeEyebrow: string;
    readonly welcomeTitle: string;
    readonly welcomeBody: string;
    readonly docsEyebrow: string;
    readonly docsTitle: string;
    readonly docsBody: string;
    readonly folders: string;
    readonly newFolder: string;
    readonly newCollection: string;
    readonly newIntent: string;
    readonly newDocument: string;
    readonly settings: string;
    readonly notes: (count: number) => string;
    readonly refreshList: string;
    readonly sortLatest: string;
    readonly sortTitle: string;
    readonly layoutFocus: string;
    readonly layoutFull: string;
    readonly layoutCompact: string;
    readonly modeEdit: string;
    readonly modeView: string;
    readonly modeSplit: string;
    readonly closeError: string;
    readonly intentEmptyLead: string;
    readonly intentEmptyTail: string;
    readonly docsEmptyLead: string;
    readonly docsEmptyTail: string;
    readonly confirmTrashDocument: (title: string) => string;
    readonly trashDocumentTitle: string;
    readonly confirmTrashFolder: string;
    readonly trashFolderTitle: string;
  };
  readonly list: {
    readonly empty: string;
    readonly label: string;
    readonly actions: (name: string) => string;
    readonly foldersLabel: (rootName: string) => string;
  };
  readonly menu: {
    readonly rename: string;
    readonly move: string;
    readonly trash: string;
  };
  readonly dialogs: {
    readonly cancel: string;
    readonly create: string;
    readonly rename: string;
    readonly move: string;
    readonly moveFolderLabel: string;
    readonly selectDestination: string;
    readonly documentName: string;
    readonly folderName: string;
    readonly intentName: string;
    readonly collectionName: string;
    readonly renameDocument: string;
    readonly renameFolder: string;
    readonly moveDocument: string;
    readonly moveFolder: string;
  };
  readonly tabs: {
    readonly label: string;
    readonly unsaved: string;
    readonly saveFailed: string;
    readonly close: (title: string) => string;
  };
  readonly save: {
    readonly dirty: string;
    readonly saving: string;
    readonly saved: string;
    readonly error: string;
  };
  readonly editor: {
    readonly body: string;
  };
};

const englishThemeLabels = {
  light: "Light",
  charcoal: "Two-Tone",
  dark: "Dark",
  system: "System",
} satisfies Record<Theme, string>;

const koreanThemeLabels = {
  light: "라이트",
  charcoal: "투톤",
  dark: "다크",
  system: "시스템",
} satisfies Record<Theme, string>;

const english: Messages = {
  locale: "en-US",
  onboarding: {
    step: (current, total) => `Step ${current} of ${total}`,
    languageTitle: "Choose the language you want to use",
    languageBody: "You can change the app language again in Settings.",
    themeTitle: "Choose a comfortable theme",
    themeBody: "Two-Tone is selected for a calm writing workspace.",
    humanTitle: "Connect your Human folder",
    humanBody: "This required folder keeps your intent and taste.",
    back: "Back",
    continue: "Continue",
    skip: "Skip",
  },
  settings: {
    title: "Settings",
    navigationLabel: "Settings navigation",
    appearance: "Appearance",
    appearanceTitle: "Make the app comfortable",
    typography: "Typography",
    typographyTitle: "Choose how your writing reads",
    language: "Language",
    languageTitle: "Choose the app language",
    theme: "Theme",
    themeLabels: englishThemeLabels,
    writingFont: "Writing font",
    sansSerif: "Sans-serif",
    sansSerifNote: "Clean and familiar · Default",
    serif: "Serif",
    serifNote: "Reflective and literary",
    preview: "Preview",
    fontPreviewTitle: "Intent becomes clearer when it is written.",
    fontPreviewBody:
      "My intent and taste are the source. I record and manage them here.",
    fontHelp:
      "Applies to writing, reading, and large empty messages. The app interface stays Sans-serif.",
    appLanguage: "App language",
    english: "English",
    englishNote: "Default",
    korean: "한국어",
    koreanNote: "Korean",
    languageHelp: "Changes apply immediately and are kept after restart.",
    close: "Close",
  },
  space: {
    switchTo: (label) => `Switch to ${label} space`,
    groupLabel: "Choose a space",
    libraryLabel: "Tasteful Intent Library",
    rootAction: (root) =>
      `Current Markdown location: ${root}. Click to choose another folder`,
  },
  docsRoots: {
    groupLabel: "Currently open AI documents",
    menuLabel: "Currently open AI paths",
    menuItem: (label, folder, path) =>
      `Open ${label} from folder ${folder}: ${path}`,
    shortcut: (label, path) => `Open path ${label}: ${path}`,
    toggle: (label, path) => `Show open AI paths for ${label}: ${path}`,
  },
  app: {
    loadError: "Could not load settings.",
    loading: "Opening Tasteful Intent.",
    chooseIntentRoot: "Choose Human folder",
    chooseDocsRoot: "Open AI document",
    welcomeEyebrow: "Tasteful Intent · Intent shaped by taste",
    welcomeTitle:
      "Start with what you think, what you want to make, and the style you want.",
    welcomeBody:
      "Share your intent and taste with AI, and it can create results that follow them. Record and manage that source here.",
    docsEyebrow: "AI · Created results",
    docsTitle: "Open a Markdown document created by AI.",
    docsBody:
      "Its source path appears automatically and remains connected to the open document.",
    folders: "Folders",
    newFolder: "New folder",
    newCollection: "New Collection",
    newIntent: "New Intent",
    newDocument: "New document",
    settings: "Settings",
    notes: (count) => `${count} notes`,
    refreshList: "Refresh document list",
    sortLatest: "Sorted by latest · click to sort by title",
    sortTitle: "Sorted by title · click to sort by latest",
    layoutFocus: "Content only · click to open three panes",
    layoutFull: "Three panes · click to close folders",
    layoutCompact: "Two panes · click for content only",
    modeEdit: "Edit · click for View",
    modeView: "View · click for Edit | View",
    modeSplit: "Edit | View · click for Edit",
    closeError: "Close error",
    intentEmptyLead: "Your intent and taste",
    intentEmptyTail: "start every AI request",
    docsEmptyLead: "Results AI created",
    docsEmptyTail: "from your intent and taste",
    confirmTrashDocument: (title) => `Move “${title}” to the system Trash?`,
    trashDocumentTitle: "Delete memo",
    confirmTrashFolder:
      "Move the selected folder and every memo inside it to the system Trash?",
    trashFolderTitle: "Delete folder",
  },
  list: {
    empty: "There are no Markdown memos in this folder.",
    label: "Markdown documents",
    actions: (name) => `${name} actions`,
    foldersLabel: (rootName) => `${rootName} folders`,
  },
  menu: {
    rename: "Rename…",
    move: "Move…",
    trash: "Move to Trash",
  },
  dialogs: {
    cancel: "Cancel",
    create: "Create",
    rename: "Rename",
    move: "Move",
    moveFolderLabel: "Folder to move to",
    selectDestination: "Choose a destination folder",
    documentName: "Title used as the filename",
    folderName: "Folder name",
    intentName: "Intent name",
    collectionName: "Collection name",
    renameDocument: "Rename memo",
    renameFolder: "Rename folder",
    moveDocument: "Move memo",
    moveFolder: "Move folder",
  },
  tabs: {
    label: "Open documents",
    unsaved: "Unsaved changes",
    saveFailed: "Save failed",
    close: (title) => `Close ${title} tab`,
  },
  save: {
    dirty: "Editing",
    saving: "Saving",
    saved: "Saved",
    error: "Save failed",
  },
  editor: {
    body: "Markdown body",
  },
};

const korean: Messages = {
  locale: "ko-KR",
  onboarding: {
    step: (current, total) => `${total}단계 중 ${current}단계`,
    languageTitle: "사용할 언어를 선택하세요",
    languageBody: "앱 언어는 설정에서 언제든 다시 바꿀 수 있습니다.",
    themeTitle: "편안한 테마를 선택하세요",
    themeBody: "차분한 글쓰기 공간을 위해 투톤이 선택되어 있습니다.",
    humanTitle: "Human 폴더를 연결하세요",
    humanBody: "의도와 취향을 보관할 필수 폴더입니다.",
    back: "뒤로",
    continue: "계속",
    skip: "건너뛰기",
  },
  settings: {
    title: "설정",
    navigationLabel: "설정 탐색",
    appearance: "화면",
    appearanceTitle: "나에게 편안한 화면",
    typography: "글꼴",
    typographyTitle: "글쓰기 글꼴을 선택하세요",
    language: "언어",
    languageTitle: "앱 언어를 선택하세요",
    theme: "테마",
    themeLabels: koreanThemeLabels,
    writingFont: "글쓰기 글꼴",
    sansSerif: "Sans-serif",
    sansSerifNote: "단정하고 익숙한 기본 글꼴",
    serif: "Serif",
    serifNote: "차분하고 문학적인 글꼴",
    preview: "미리보기",
    fontPreviewTitle: "의도는 적어볼 때 더 선명해집니다.",
    fontPreviewBody:
      "나의 의도와 취향이 바로 원천입니다. 여기서 이를 메모하고, 관리합니다.",
    fontHelp:
      "글쓰기·읽기와 큰 빈 화면 문구에 적용됩니다. 앱 조작 화면은 Sans-serif를 유지합니다.",
    appLanguage: "앱 언어",
    english: "English",
    englishNote: "기본값",
    korean: "한국어",
    koreanNote: "한국어",
    languageHelp: "선택 즉시 적용되며 재시작 후에도 유지됩니다.",
    close: "닫기",
  },
  space: {
    switchTo: (label) => `${label} 공간으로 전환`,
    groupLabel: "공간 선택",
    libraryLabel: "Tasteful Intent 라이브러리",
    rootAction: (root) => `현재 Markdown 위치: ${root}. 클릭하여 폴더 변경`,
  },
  docsRoots: {
    groupLabel: "열린 AI 문서",
    menuLabel: "열린 AI path",
    menuItem: (label, folder, path) =>
      `${folder} folder의 path ${label} 열기: ${path}`,
    shortcut: (label, path) => `path ${label} 열기: ${path}`,
    toggle: (label, path) => `path ${label}의 열린 AI path 보기: ${path}`,
  },
  app: {
    loadError: "설정을 불러오지 못했습니다.",
    loading: "Tasteful Intent를 여는 중입니다.",
    chooseIntentRoot: "Human folder 선택",
    chooseDocsRoot: "AI 문서 열기",
    welcomeEyebrow: "Tasteful Intent · 취향 담은 의도",
    welcomeTitle: "내 생각과 만들고 싶은 것, 원하는 스타일을 먼저 적어보세요.",
    welcomeBody:
      "나의 의도와 취향을 AI에 전하면, AI는 그에 맞는 결과를 만들어 줍니다. 모든 결과의 출발점인 의도와 취향을 이곳에 기록하고 관리하세요.",
    docsEyebrow: "AI · 구현 결과",
    docsTitle: "AI가 만든 Markdown 문서를 여세요.",
    docsBody:
      "문서를 열면 source path가 자동으로 나타나고 열린 문서와 계속 연결됩니다.",
    folders: "폴더",
    newFolder: "새 폴더",
    newCollection: "새 모음",
    newIntent: "새로운 의도",
    newDocument: "새 문서",
    settings: "설정",
    notes: (count) => `메모 ${count}개`,
    refreshList: "문서 목록 새로 고침",
    sortLatest: "현재 최신 순 · 클릭하면 제목 순",
    sortTitle: "현재 제목 순 · 클릭하면 최신 순",
    layoutFocus: "현재 content-only · 클릭하면 3-pane 열기",
    layoutFull: "현재 3-pane · 클릭하면 folder pane 닫기",
    layoutCompact: "현재 2-pane · 클릭하면 content-only 전환",
    modeEdit: "현재 Edit · 클릭하면 View",
    modeView: "현재 View · 클릭하면 Edit | View 분할",
    modeSplit: "현재 Edit | View 분할 · 클릭하면 Edit",
    closeError: "오류 닫기",
    intentEmptyLead: "내가 남기는 의도와 취향,",
    intentEmptyTail: "AI 요청의 출발점입니다",
    docsEmptyLead: "내 의도와 취향으로",
    docsEmptyTail: "AI가 만든 결과입니다",
    confirmTrashDocument: (title) =>
      `“${title}” 메모를 시스템 휴지통으로 이동할까요?`,
    trashDocumentTitle: "메모 삭제",
    confirmTrashFolder:
      "선택한 폴더와 안의 모든 메모를 시스템 휴지통으로 이동할까요?",
    trashFolderTitle: "폴더 삭제",
  },
  list: {
    empty: "이 폴더에는 Markdown 메모가 없습니다.",
    label: "Markdown 문서",
    actions: (name) => `${name} 동작`,
    foldersLabel: (rootName) => `${rootName} 폴더`,
  },
  menu: {
    rename: "이름 변경…",
    move: "이동…",
    trash: "휴지통으로 이동",
  },
  dialogs: {
    cancel: "취소",
    create: "만들기",
    rename: "이름 변경",
    move: "이동",
    moveFolderLabel: "이동할 폴더",
    selectDestination: "대상 폴더 선택",
    documentName: "파일명이 될 제목",
    folderName: "폴더 이름",
    intentName: "의도 이름",
    collectionName: "모음 이름",
    renameDocument: "메모 이름 변경",
    renameFolder: "폴더 이름 변경",
    moveDocument: "메모 이동",
    moveFolder: "폴더 이동",
  },
  tabs: {
    label: "열린 문서",
    unsaved: "저장되지 않은 변경",
    saveFailed: "저장 실패",
    close: (title) => `${title} 탭 닫기`,
  },
  save: {
    dirty: "편집 중",
    saving: "저장 중",
    saved: "저장됨",
    error: "저장 실패",
  },
  editor: {
    body: "Markdown 본문",
  },
};

const messagesByLanguage = { en: english, ko: korean } satisfies Record<
  Language,
  Messages
>;

const I18nContext = createContext<Messages>(english);

type I18nProviderProps = {
  readonly children: ReactNode;
  readonly language: Language;
};

export function I18nProvider({ children, language }: I18nProviderProps) {
  return createElement(
    I18nContext.Provider,
    { value: messagesByLanguage[language] },
    children,
  );
}

export function getMessages(language: Language): Messages {
  return messagesByLanguage[language];
}

export function useI18n(): Messages {
  return useContext(I18nContext);
}

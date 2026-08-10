# AI Path Identity + Dropdown Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI space의 `A | B | C` 문서 식별자를 content tab의 compact `A badge + Title` 표시(개념적으로 `[A] Title`)와 1:1로 연결하고, generic `+`를 명확한 Open File용 `FilePlus2`로 교체하며, path 드롭다운의 각 row에 tab과 동일한 close 컨트롤을 추가하고, 좁은 sidebar에서도 folder명과 canonical path의 마지막 구간이 잘 보이게 한다.

**Architecture:** 현재 `DocsRootSwitcher` 내부의 index→`A..Z/27..` 변환을 `src/lib/documentShortcutLabel.ts`의 단일 helper로 추출해 `DocsRootSwitcher`와 `TabBar`가 함께 사용한다. 두 컴포넌트 모두 같은 `workspace.openDocuments` 순서를 받으므로 별도 persisted label이나 state 없이 동일 문서에 동일 문자를 표시하고, close로 순서가 바뀌면 양쪽이 함께 다시 계산된다. Source Card의 기존 30px Open File slot은 유지하고 icon만 `FilePlus2`로 교체한다. `DocsRootSwitcher`에는 required `onClose(identity)` prop을 추가하고 App의 기존 `closeTab`을 그대로 배선한다. 드롭다운 row는 단일 `menuitemradio` 버튼에서 wrapper + 선택 버튼 + close 버튼 형제 구조(`TabBar`와 동일한 패턴 — 버튼 안에 버튼은 invalid HTML)로 바꾼다. 저장 → 닫기 → fallback 활성화 → 세션/`docsRoot` 갱신은 기존 `closeTab`(`src/App.tsx:628`) → `closeDocument`(`src/hooks/useLibraryWorkspace.ts:592`) 경계를 재사용한다. 실제 UI smoke에서 확인된 연속성 결함을 막기 위해 inactive close에는 fallback root scan을 하지 않고, 이미 활성 snapshot과 일치하는 settings root 동기화는 workspace를 loading 상태로 되돌리지 않는다. row close 성공 후 menu를 유지하고 active/remaining 선택 row로 focus를 복구하며, 마지막 문서 close는 switcher unmount로 종료한다.

**Tech Stack:** React + TypeScript, Vitest + Testing Library(jsdom), lucide-react 아이콘, Biome, Tauri v2.

## Global Constraints

- 새 의존성 추가 금지 (repo `CLAUDE.md`).
- diff 최소 유지. 항상 보이는 30px `A | B` 칩(shortcut row)의 anatomy는 변경하지 않는다. 동일 문자를 AI content tab 제목 앞에 compact badge로 투영하고, close는 드롭다운 row에만 추가한다.
- **Git commit/push 금지 — 커밋은 사용자가 수행한다.** 각 task 종료 시 변경 파일 목록을 보고하고 멈춘다.
- i18n 새 키 금지: 기존 `messages.tabs.close(title)`(`"Close {title} tab"` / `"{title} 탭 닫기"`)를 재사용한다. 실제로 tab을 닫는 동작이므로 의미가 일치한다.
- folder명과 canonical path는 copy column의 우측 끝선을 공유한다. 긴 path는 시작 부분보다 마지막 folder/file segment를 우선 노출하되 tooltip과 accessible name은 계속 전체 path를 제공한다.
- AI tab badge는 open document index의 파생값이며 settings/session에 저장하지 않는다. Human tab에는 badge를 표시하지 않는다.
- JSX props와 타입 필드는 기존 파일처럼 알파벳 순서를 유지한다 (Biome).
- 검증 순서: targeted vitest → `pnpm test` → `pnpm check` → `pnpm build` → 수동 Tauri smoke test. Rust 변경 없음(cargo 게이트 불필요).

## 동작 규칙 (spec 요약)

- AI Source Card의 첫 문서는 `A`, 둘째 문서는 `B`이며 같은 문자의 compact badge를 content tab 제목 앞에 표시한다. 화면상 `A | Title` 관계가 보이고 accessible name은 `A, Title, canonical path`를 포함한다.
- 문서를 닫아 순서가 당겨지면 Source Card shortcut, dropdown row, content tab badge가 같은 render에서 함께 재계산된다. 예: `A/B/C` 중 B를 닫으면 기존 C가 양쪽에서 B가 된다.
- 26개 이후 표시는 기존 계약과 동일하게 `27`, `28`을 사용한다. label은 persisted identity가 아니며 `{ root, path }` identity를 대체하지 않는다.
- Human tab은 기존 단일-line 제목과 accessible name을 유지하고 문자 badge를 렌더하지 않는다.
- shortcut row 끝의 30px Open File action은 `FilePlus2`를 표시하고 기존 localized tooltip/accessible label을 유지한다. text pill과 새 i18n key는 추가하지 않는다.
- 드롭다운 각 row 끝에 X 버튼. 클릭 시 `onClose(identity)` 호출 — tab X와 완전히 동일한 동작.
- close 후 드롭다운은 **열린 채 유지**(연속으로 여러 개 닫기 가능). 기존 `useEffect`가 active row로 포커스를 복구한다.
- active row를 닫으면 `closeTab`의 fallback(다음/이전 문서 활성화 + `docsRoot`/세션 갱신)이 그대로 적용된다.
- 마지막 row를 닫으면 열린 문서가 0개가 되어 컴포넌트 전체가 unmount되고 AI welcome 상태로 돌아간다 (`DocsRootSwitcher.tsx:43`의 `if (!activeDocument) return null`).
- 저장 실패 시 `closeDocument`가 false를 반환하고 문서가 유지된다 — row도 그대로 남는다.
- X 클릭은 `onSelect`를 발화하지 않는다.
- folder명과 path는 active check/X 바로 앞에서 right align하고, 긴 path는 `/Users/...` 시작부가 아니라 마지막 parent/file segment를 남긴다. slash와 filename의 문자 순서는 뒤집히지 않아야 한다.

## Decision Gates

- [x] AI 문자 label lifecycle
  - Impact: 사용자가 `A/B/C`를 문서의 안정적 이름으로 기억할 수 있는지, close 후 표시가 어떻게 변하는지, persistence/state가 필요한지 결정한다.
  - Current evidence: `DocsRootSwitcher.tsx`는 현재 `documents.map` index에서 문자를 매 render마다 파생하며, Source Card와 `TabBar`는 동일한 `workspace.openDocuments` 순서를 소비한다.
  - Recommended default: positional label. close 후 남은 문서를 `A..`로 다시 계산하고 shortcut·dropdown·tab badge를 같은 render에서 함께 갱신한다.
  - Recommended rationale: 별도 persisted ID나 tombstone이 필요 없고 현재 Source Card 동작과 일치한다. stable label은 orientation은 좋지만 session schema와 open/close/reopen 할당 정책까지 새로 정의해야 한다.
  - Status: resolved — A, positional label. 중간 문서를 닫으면 남은 문서를 `A..`로 재번호화하고 shortcut·dropdown·tab badge를 함께 갱신한다. label은 persistence/session identity에 저장하지 않는다.

- [x] AI tab badge 시각 표현
  - Impact: `[A] Title`이 literal text인지 Source Card와 연결되는 bordered badge인지 결정한다.
  - Current evidence: Source Card는 30px bordered square chip이며 AI tab은 현재 2-line title/path anatomy다.
  - Recommended default: 18px compact bordered badge `A` + title. literal bracket glyph는 사용하지 않는다.
  - Recommended rationale: Source Card chip과 같은 visual grammar로 연결성을 보이면서 tab 폭 사용을 제한한다.
  - Status: resolved — A, 18px compact bordered badge `A` + title. literal `[`/`]` glyph는 사용하지 않고 Source Card chip의 border/tint 문법을 축소해 재사용한다.

- [x] 공통 label helper 파일 경로
  - Impact: 새 artifact의 소유 위치와 두 컴포넌트의 dependency 방향을 결정한다.
  - Current evidence: 변환 함수는 현재 `DocsRootSwitcher.tsx` local helper이고 `src/lib/`에는 UI와 무관한 공유 변환 helper가 위치한다.
  - Recommended default: `src/lib/documentShortcutLabel.ts`.
  - Recommended rationale: `DocsRootSwitcher`와 `TabBar` 어느 한쪽에 소유권을 두지 않고 dependency cycle 없이 공유할 수 있다.
  - Status: resolved — A, `src/lib/documentShortcutLabel.ts`. 단일-purpose 순수 helper로 두 컴포넌트가 공유한다.

- [x] Open File control 표현
  - Impact: 새 Markdown 파일 action의 발견성과 216px Source Card에서 동시에 보이는 shortcut 수를 결정한다.
  - Current evidence: 최신 screenshot은 216px pane에 A/B/C/D와 기존 30px `+`를 표시한다. 이전 244px HTML 비교의 `FilePlus2 + Open File` pill은 네 개 이상의 shortcut에서 가로 overflow를 더 일찍 유발한다.
  - Recommended default: 기존 30px trailing slot을 유지하고 generic `Plus`를 `FilePlus2`로 교체하며 tooltip/accessible label은 localized `Open AI document`를 유지한다.
  - Recommended rationale: document outline으로 folder-add와 구분하면서 네 개 shortcut의 동시 가시성과 2단 카드 geometry를 보존한다. labeled pill은 의미가 가장 명확하지만 실제 216px 폭에서는 shortcut 탐색 비용을 늘린다.
  - Status: resolved — A, 기존 30px trailing slot에서 `FilePlus2`를 사용한다. tooltip/accessible label은 기존 localized `messages.app.chooseDocsRoot`를 유지하며 text pill과 새 i18n key는 추가하지 않는다.

- [x] Dropdown row close 후 menu lifecycle
  - Impact: 한 문서만 닫는 기본 흐름, 여러 문서 연속 close, focus 복구 방식이 달라진다.
  - Current evidence: row 선택은 menu를 닫고 opener로 focus를 복구한다. 현재 draft plan은 row close만 menu를 열린 채 유지해 연속 close를 허용하도록 작성되어 있으나 사용자 결정으로 확정되지 않았다.
  - Recommended default: close 성공 후 menu를 열린 채 유지한다. active/remaining row로 focus를 이동하고 마지막 문서를 닫으면 switcher unmount로 welcome 상태가 된다.
  - Recommended rationale: dropdown에 별도 close를 추가하는 핵심 이점인 빠른 정리를 살리고, tab bar close와 달리 목록 context를 유지한다. 반대로 menu를 닫으면 구현/focus는 단순하지만 여러 문서를 정리할 때 매번 다시 열어야 한다.
  - Status: resolved — A, close 성공 후 menu를 유지하고 active/remaining 선택 row로 focus를 이동한다. 마지막 문서는 switcher unmount와 AI welcome 전환으로 종료한다.

## Repo-evidence Resolutions

- badge active state는 별도 결정 gate로 묻지 않는다. `DESIGN.md`의 active tab underline과 기존 `.docs-root-shortcut.active` 계약에 따라 inactive badge는 neutral border/text, active tab badge만 `--space-accent`/`--space-tint`를 사용한다.
- 26개 이후 label은 기존 `DocsRootSwitcher` 계약(`27`, `28`...)을 공통 helper로 이동할 뿐 변경하지 않는다.
- badge는 screen-reader 중복을 피하도록 `aria-hidden` 처리하고 기존 AI tab accessible name을 `letter, title, canonical path`로 확장한다. close accessible copy는 기존 `messages.tabs.close(title)`을 재사용한다.
- Open File copy는 기존 `messages.app.chooseDocsRoot`를 tooltip/accessible label로 재사용하므로 i18n key와 번역을 추가하지 않는다.
- Human tab과 `{ root, path }` identity/session schema는 변경하지 않는다.

---

### Task 1: DocsRootSwitcher per-row close control

**Files:**
- Modify: `src/components/DocsRootSwitcher.tsx`
- Modify: `src/App.tsx` (DocsRootSwitcher 사용처 2곳: folder pane ~746, list pane fallback ~807)
- Modify: `src/index.css` (`.docs-root-menu-item` 섹션 인근, ~929)
- Test: `src/components/DocsRootSwitcher.test.tsx`

**Interfaces:**
- Produces: `DocsRootSwitcherProps`에 `readonly onClose: (identity: string) => Promise<void>` 추가. `identity`는 `getIdentity(document)`가 반환하는 값과 동일(`` `${root}\0${path}` ``).
- Consumes: `App.tsx`의 기존 `closeTab(identity: string): Promise<void>`(`src/App.tsx:628`), i18n `messages.tabs.close(title)`.

- [x] **Step 1: 실패하는 테스트 작성**

`src/components/DocsRootSwitcher.test.tsx`에 아래 네 테스트를 추가한다. 또한 required prop 추가로 타입이 깨지지 않도록 **기존 모든 `<DocsRootSwitcher ... />` render 호출(8곳)에 `onClose={vi.fn().mockResolvedValue(undefined)}` 한 줄을 추가**한다 (props 알파벳 순서상 `getIdentity` 다음).

```tsx
it("renders Open File as a document action instead of a generic add", () => {
  render(
    <DocsRootSwitcher
      activeIdentity={"/work/a\0a.md"}
      documents={documents}
      getIdentity={getIdentity}
      onClose={vi.fn().mockResolvedValue(undefined)}
      onOpenDocument={vi.fn()}
      onSelect={vi.fn().mockResolvedValue(undefined)}
    />,
  );

  const openButton = screen.getByRole("button", {
    name: "Open AI document",
  });
  expect(openButton.querySelector(".lucide-file-plus-corner")).not.toBeNull();
  expect(openButton.querySelector(".lucide-plus")).toBeNull();
});
```

```tsx
it("renders a close control for each dropdown row", async () => {
  const user = userEvent.setup();
  render(
    <DocsRootSwitcher
      activeIdentity={"/work/a\0a.md"}
      documents={documents}
      getIdentity={getIdentity}
      onClose={vi.fn().mockResolvedValue(undefined)}
      onOpenDocument={vi.fn()}
      onSelect={vi.fn().mockResolvedValue(undefined)}
    />,
  );

  await user.click(
    screen.getByRole("button", {
      name: "Show open AI paths for A: /work/a/a.md",
    }),
  );

  expect(
    screen.getByRole("button", { name: "Close A document tab" }),
  ).toBeDefined();
  expect(
    screen.getByRole("button", { name: "Close B document tab" }),
  ).toBeDefined();
});

it("closes the connected document from the dropdown without selecting it", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn().mockResolvedValue(undefined);
  const onSelect = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(
    <DocsRootSwitcher
      activeIdentity={"/work/a\0a.md"}
      documents={documents}
      getIdentity={getIdentity}
      onClose={onClose}
      onOpenDocument={vi.fn()}
      onSelect={onSelect}
    />,
  );

  await user.click(
    screen.getByRole("button", {
      name: "Show open AI paths for A: /work/a/a.md",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Close B document tab" }),
  );

  expect(onClose).toHaveBeenCalledWith("/other/b\0b.md");
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole("menu")).toBeDefined();

  rerender(
    <DocsRootSwitcher
      activeIdentity={"/work/a\0a.md"}
      documents={documents.slice(0, 1)}
      getIdentity={getIdentity}
      onClose={onClose}
      onOpenDocument={vi.fn()}
      onSelect={onSelect}
    />,
  );

  const remaining = screen.getByRole("menuitemradio", {
    name: "Open A from folder a: /work/a/a.md",
  });
  await waitFor(() => expect(document.activeElement).toBe(remaining));
});

it("reports a rejected dropdown close and keeps the menu open", async () => {
  const user = userEvent.setup();
  const closeError = new Error("Close failed");
  const onClose = vi.fn().mockRejectedValue(closeError);
  const report = vi.fn();
  vi.stubGlobal("reportError", report);
  render(
    <DocsRootSwitcher
      activeIdentity={"/work/a\0a.md"}
      documents={documents}
      getIdentity={getIdentity}
      onClose={onClose}
      onOpenDocument={vi.fn()}
      onSelect={vi.fn().mockResolvedValue(undefined)}
    />,
  );

  await user.click(
    screen.getByRole("button", {
      name: "Show open AI paths for A: /work/a/a.md",
    }),
  );
  await user.click(
    screen.getByRole("button", { name: "Close B document tab" }),
  );

  await waitFor(() => expect(report).toHaveBeenCalledWith(closeError));
  expect(screen.getByRole("menu")).toBeDefined();
});
```

- [x] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run src/components/DocsRootSwitcher.test.tsx`
Expected: close control 테스트 3개는 해당 button 부재로 FAIL하고 Open File icon 테스트는 `FilePlus2`가 이 lucide 버전에서 render하는 `.lucide-file-plus-corner` 부재로 FAIL한다. 기존 테스트는 통과 유지.

- [x] **Step 3: 컴포넌트 구현**

`src/components/DocsRootSwitcher.tsx`:

1. import의 generic `Plus`를 `FilePlus2`로 교체하고 `X`를 추가:

```tsx
import { Check, ChevronDown, FilePlus2, X } from "lucide-react";
```

2. props 타입에 추가 (`getIdentity` 다음):

```tsx
  readonly onClose: (identity: string) => Promise<void>;
```

함수 시그니처 destructuring에도 같은 위치에 `onClose`를 추가한다.

3. close 후 focus 유실을 막도록 `documentCount = documents.length`를 계산하고 기존 `useEffect` dependency에 추가한다. non-active row close처럼 `activeIndex`가 같아도 document count가 바뀌면 새 row DOM의 active/remaining 선택 row로 focus를 복구한다:

```tsx
const documentCount = documents.length;

useEffect(() => {
  if (documentCount > 0 && expanded) {
    itemRefs.current[Math.max(activeIndex, 0)]?.focus();
  }
}, [activeIndex, documentCount, expanded]);
```

4. 드롭다운 render(현재 144-186행)의 단일 버튼 row를 wrapper + 형제 버튼 구조로 교체. `key`는 wrapper로 이동하고, `itemRefs`/`onKeyDown`은 선택 버튼에 그대로 남는다. close 핸들러는 `setExpanded(false)`를 **호출하지 않는다** (메뉴 유지). `onClose`가 resolve하면 parent의 document count 변경으로 effect가 focus를 복구하고, reject 시 현재 X와 menu를 유지한다:

```tsx
return (
  <div className="docs-root-menu-row" key={identity} role="presentation">
    <button
      aria-checked={active}
      aria-label={messages.docsRoots.menuItem(label, folder, fullPath)}
      className={`docs-root-menu-item ${active ? "active" : ""}`}
      onClick={async () => {
        try {
          await onSelect(identity);
        } catch (cause) {
          reportError(cause);
        } finally {
          close();
        }
      }}
      onKeyDown={(event) => handleMenuKeyDown(event, index)}
      ref={(node) => {
        itemRefs.current[index] = node;
      }}
      role="menuitemradio"
      title={`${label}: ${fullPath}`}
      type="button"
    >
      <span className="docs-root-menu-letter">{label}</span>
      <span className="docs-root-menu-copy">
        <strong>{folder}</strong>
        <small>
          <span>{fullPath}</span>
        </small>
      </span>
      {active ? <Check aria-hidden="true" size={13} /> : null}
    </button>
    <button
      aria-label={messages.tabs.close(document.title)}
      className="docs-root-menu-close"
      onClick={async () => {
        try {
          await onClose(identity);
        } catch (cause) {
          reportError(cause);
        }
      }}
      type="button"
    >
      <X aria-hidden="true" size={13} />
    </button>
  </div>
);
```

5. `src/index.css`의 기존 copy 규칙을 trailing alignment로 바꾼다. path text에 RTL direction trick을 적용하지 않고, overflow-hidden flex container의 우측 끝에 고정폭 LTR child를 배치해 시작부만 clip한다. 이렇게 하면 slash/filename 문자 순서를 보존하면서 마지막 parent/file segment를 남길 수 있다:

```css
.docs-root-menu-copy > strong {
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  white-space: nowrap;
}

.docs-root-menu-copy > small {
  display: flex;
  min-width: 0;
  justify-content: flex-end;
  overflow: hidden;
  color: var(--sidebar-muted);
  font-size: 10px;
}

.docs-root-menu-copy > small > span {
  direction: ltr;
  flex: 0 0 auto;
  unicode-bidi: isolate;
  white-space: nowrap;
}
```

6. shortcut row의 `.docs-root-open` 내부 icon을 교체한다. button의 class, handler, tooltip, accessible label은 그대로 유지한다:

```tsx
<FilePlus2 aria-hidden="true" size={15} />
```

7. `.docs-root-menu-copy > small` 블록 아래에 close row CSS를 추가:

```css
.docs-root-menu-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
}

.docs-root-menu-close {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  margin-right: 2px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--sidebar-muted);
  cursor: pointer;
}

.docs-root-menu-close:hover,
.docs-root-menu-close:focus-visible {
  background: var(--selection);
  color: var(--selection-text);
}

.docs-root-menu-close:focus-visible {
  outline: 2px solid var(--space-accent);
  outline-offset: -2px;
}
```

- [x] **Step 4: App 배선**

`src/App.tsx`의 DocsRootSwitcher 사용처 2곳(folder pane ~746, list pane fallback ~807) 모두 `getIdentity` 다음에 prop 추가:

```tsx
onClose={closeTab}
```

- [x] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run src/components/DocsRootSwitcher.test.tsx`
Expected: 전체 PASS (기존 8개 + 신규 4개).

- [x] **Step 6: 전체 게이트**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 모두 PASS. 실패 시 수정 후 재실행.

- [x] **Step 7: 변경 파일 보고 (커밋은 사용자)**

변경 파일: `src/components/DocsRootSwitcher.tsx`, `src/App.tsx`, `src/index.css`, `src/components/DocsRootSwitcher.test.tsx`. 제안 커밋 메시지: `feat(ui): add close control to ai path dropdown rows`.

---

### Task 2: AI shortcut 문자와 content tab badge 연결

**Files:**
- Create: `src/lib/documentShortcutLabel.ts`
- Modify: `src/components/DocsRootSwitcher.tsx`
- Modify: `src/components/TabBar.tsx`
- Modify: `src/index.css` (`.tab-copy` / `.tab-title` 인근, ~1088)
- Test: `src/App.test.tsx` (`AI multi-root workspace`, `content toolbar`)

**Interfaces:**
- Produces: `documentShortcutLabel(index: number): string` — `0..25`는 `A..Z`, 이후는 1-based 숫자(`26 → "27"`).
- Consumes: `DocsRootSwitcher.documents`와 `TabBar.documents`. App이 두 컴포넌트에 동일한 `workspace.openDocuments` 순서를 전달하는 기존 계약.
- 화면 label일 뿐 identity가 아니다. 선택/닫기/key에는 계속 `getDocumentIdentity(document)`의 `{root}\0{path}` 값을 사용한다.

- [x] **Step 1: 실패하는 App 통합 테스트 작성**

`src/App.test.tsx`의 `AI multi-root workspace > shows letter shortcuts connected to the open documents`를 다음 계약으로 확장한다.

```tsx
const firstTab = screen.getByRole("tab", {
  name: "A, First, /docs/a/a.md",
});
const secondTab = screen.getByRole("tab", {
  name: "B, Second, /docs/b/b.md",
});

expect(firstTab.querySelector(".tab-source-label")?.textContent).toBe("A");
expect(secondTab.querySelector(".tab-source-label")?.textContent).toBe("B");
```

같은 파일의 `content toolbar > keeps the pane control before tabs...`에는 Human 회귀를 추가한다:

```tsx
expect(tab.querySelector(".tab-source-label")).toBeNull();
```

- [x] **Step 2: 테스트 실패 확인**

Run: `pnpm vitest run src/App.test.tsx -t "shows letter shortcuts connected|keeps the pane control"`

Expected: AI tab accessible name과 `.tab-source-label` 부재로 첫 테스트 FAIL, Human 회귀는 기존 동작이므로 PASS.

- [x] **Step 3: 공통 label helper 추출**

`src/lib/documentShortcutLabel.ts`:

```ts
export const documentShortcutLabel = (index: number) =>
  index < 26
    ? String.fromCharCode("A".charCodeAt(0) + index)
    : String(index + 1);
```

`src/components/DocsRootSwitcher.tsx`의 local `shortcutLabel` 선언을 삭제하고 helper를 import한다. 파일 안의 기존 호출 3곳은 `documentShortcutLabel(...)`로 바꾼다. 이 단계는 shortcut의 현재 화면/접근성 동작을 바꾸지 않는다.

- [x] **Step 4: TabBar에 AI badge 렌더**

`src/components/TabBar.tsx`:

1. 같은 helper를 import한다.
2. `documents.map((document) => {`를 `documents.map((document, index) => {`로 바꾸고 `const sourceLabel = documentShortcutLabel(index);`를 계산한다.
3. docs mode의 accessible name을 `` `${sourceLabel}, ${document.title}, ${fullPath}` ``로 확장한다. Human의 undefined accessible name은 그대로 둔다.
4. 제목 row를 다음처럼 바꾼다. badge의 visible 문자는 accessible name에서 이미 읽히므로 badge 자체는 `aria-hidden` 처리한다:

```tsx
<span className="tab-title-row">
  {docsMode ? (
    <span aria-hidden="true" className="tab-source-label">
      {sourceLabel}
    </span>
  ) : null}
  <span className="tab-title">{document.title}</span>
</span>
```

화면 의미는 `[A] Title`이지만 literal `[`/`]` glyph는 쓰지 않고 Source Card chip과 연결되는 compact bordered badge로 표현한다.

- [x] **Step 5: badge layout CSS 추가**

`src/index.css`의 `.tab-copy` 아래에 추가:

```css
.tab-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
}

.tab-source-label {
  display: grid;
  width: 18px;
  height: 18px;
  flex: 0 0 18px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font-size: 9px;
  font-weight: 800;
}

.tab-item.active .tab-source-label {
  border-color: var(--space-accent);
  background: var(--space-tint);
  color: var(--space-text);
}

.tab-title-row > .tab-title {
  min-width: 0;
  flex: 1;
}
```

기존 `.tab-title` ellipsis를 재사용해 badge는 고정하고 긴 제목만 줄인다. AI tab의 둘째 path row와 46px header 높이는 변경하지 않는다.

- [x] **Step 6: targeted/full 자동 검증**

Run:

```bash
pnpm vitest run src/App.test.tsx src/components/DocsRootSwitcher.test.tsx
pnpm test
pnpm check
pnpm build
```

Expected: 전부 PASS. AI tab은 `A/B` badge와 확장된 accessible name을 갖고, Human tab과 기존 Source Card shortcut 테스트는 그대로 통과한다.

- [x] **Step 7: 변경 파일 보고 (커밋은 사용자)**

변경 파일: `src/lib/documentShortcutLabel.ts`, `src/components/DocsRootSwitcher.tsx`, `src/components/TabBar.tsx`, `src/index.css`, `src/App.test.tsx`. 제안 커밋 메시지: `feat(ui): connect ai shortcuts to document tabs`.

---

### Task 3: Contract 문서 갱신 + 수동 smoke test

**Files:**
- Modify: `CLAUDE.md` (UI Contract 절)
- Modify: `DESIGN.md` (`ActiveRoot / AI Path Shortcuts` 절)
- Modify: `docs/specs/intent-memo.md` (91행 Source Card 절, 191행 smoke checklist)

**Interfaces:**
- Consumes: Task 1의 완성된 드롭다운 close 동작과 Task 2의 AI tab badge 연결.
- Produces: 코드와 일치하는 계약 문구 (후속 작업의 기준 문서).

- [x] **Step 1: CLAUDE.md 문구 교체**

기존:

```text
The row `+` opens another Markdown file and never registers a folder. Closing a tab removes its dropdown/shortcut item; there is no folder add/remove UI.
```

신규:

```text
The row's 30px `FilePlus2` action opens another Markdown file and never registers a folder. Each AI content tab starts with the same derived letter badge as its Source Card shortcut, while Human tabs remain unchanged. Closing a tab removes its dropdown/shortcut item, and each dropdown row ends with a close control that closes the same connected tab while keeping the menu open for consecutive closes; there is no folder add/remove UI.
```

바로 다음 AI tab 문장에는 `The badge and shortcut are derived from the same open-document order and are never persisted identity.`를 추가한다.

- [x] **Step 2: docs/specs/intent-memo.md 갱신**

91행의 `` `+`는 Markdown Open File만 실행하고 add/remove folder UI는 없다. `` 문장을 다음 계약으로 교체한다:

```text
shortcut row 끝의 30px `FilePlus2`는 Markdown Open File만 실행하고 add/remove folder UI는 없다. Dropdown 각 row 끝의 close 컨트롤은 연결된 tab close와 동일하게 동작하고 성공 후 menu를 유지하며, 마지막 문서를 닫으면 AI welcome 상태로 돌아간다.
```

191행 smoke checklist의 `shortcut row `+`의 Open File picker`를 `shortcut row FilePlus2의 Open File picker`로 교체하고 `dropdown row close 컨트롤과 연속 close focus` 확인 항목을 같은 문장 안에 추가한다.

같은 91행 Source Card 계약에 다음 문장을 추가한다:

```text
Dropdown의 folder명과 canonical path는 우측 끝선을 맞추고, 긴 path는 마지막 folder/file segment가 남도록 앞부분을 생략한다.
```

93행 content tab 계약의 AI tab 설명에는 다음 문장을 추가한다:

```text
각 AI tab 제목 앞에는 Source Card shortcut과 동일한 compact 문자 badge를 표시하며, accessible name은 문자·제목·전체 canonical path를 함께 제공한다. Human tab에는 badge를 표시하지 않는다.
```

- [x] **Step 3: DESIGN.md 정렬 계약 갱신**

`ActiveRoot / AI Path Shortcuts` 절에 다음 문장을 추가한다:

```text
- shortcut row 끝의 Open File action은 30px `FilePlus2` icon을 사용하고 localized tooltip/accessible label을 유지한다.
- dropdown copy column은 folder명과 canonical path를 trailing-align한다. path overflow는 마지막 parent/file segment를 우선 노출하고 full canonical path는 tooltip과 accessible name에 유지한다.
- dropdown close 성공 후 menu를 유지하고 active/remaining 선택 row로 keyboard focus를 복구한다. 마지막 문서 close는 switcher unmount와 AI welcome 전환으로 종료한다.
```

`TabBar / TabItem` 절의 AI tab 계약에는 다음 문장을 추가한다:

```text
- 각 AI tab 첫 줄은 Source Card와 같은 open-document 순서에서 파생한 compact 문자 badge를 제목 앞에 표시한다. badge/shortcut은 `{ root, path }` identity를 대체하거나 settings에 저장하지 않으며, close로 순서가 바뀌면 함께 다시 계산한다. Human tab에는 badge를 표시하지 않는다.
```

- [x] **Step 4: 수동 Tauri smoke test**

Run: `pnpm tauri:dev`
확인 절차:
1. AI space에서 Markdown 파일 2개를 Open File로 연다 (A, B 생성 확인).
2. Source Card의 A/B와 content tab의 `A Title`/`B Title` badge가 같은 파일을 가리키는지 선택 전환으로 확인한다. tab tooltip과 screen reader accessible name에는 전체 canonical path가 유지되어야 한다.
3. 드롭다운을 펼쳐 비활성 B row의 X 클릭 → 해당 tab/칩/row가 사라지고 active 문서는 유지된다. 기존 C가 있었다면 Source Card·dropdown·tab 모두 같은 render에서 B로 당겨지는지 확인한다.
4. 파일 2개를 다시 열고 active row의 X 클릭 → fallback 문서가 활성화되고 경로 표시와 tab badge가 함께 따라간다.
5. 마지막 row의 X 클릭 → 스위처가 사라지고 AI welcome 화면으로 돌아간다.
6. Human space로 전환해 tab 제목 앞에 문자 badge가 없고 기존 한 줄 title이 유지되는지 확인한다.
7. 키보드: 드롭다운에서 Tab으로 X에 도달, Enter로 close 동작 확인.
8. 깊은 경로의 AI 파일(예: `/Users/.../backend/docs/cpq-workflow/plans/example.md`)을 열고 folder명과 path의 우측 끝선이 맞는지, path가 잘릴 때 `plans/example.md`처럼 마지막 구간이 남는지 확인한다.
9. Light·Two-Tone·Dark에서 216px folder pane과 280px list-pane fallback 모두 slash/filename 순서가 뒤집히지 않고 active check/X와 text가 겹치지 않는지, content tab badge와 긴 title/close icon이 겹치지 않는지 확인한다.

Expected: 위 9개 전부 통과. 실패한 영역에 따라 Task 1 또는 Task 2로 돌아가 수정.

시각 증거는 사용자 제보와 같은 좁은 sidebar + content tab framing으로 `/tmp/intent-memo-ai-path-tab-identity.png`에 캡처하고 repo에는 추가하지 않는다.

- [x] **Step 5: 변경 파일 보고 (커밋은 사용자)**

변경 파일: `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`. 실제 UI smoke에서 발견한 inactive close snapshot 전환과 active cross-root close remount를 수정하기 위해 `src/hooks/useLibraryWorkspace.ts`, `src/hooks/useLibraryWorkspace.test.tsx`도 함께 변경했다. 제안 커밋 메시지: `feat(ui): connect ai paths and close controls`.

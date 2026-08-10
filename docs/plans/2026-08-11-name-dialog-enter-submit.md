# NameDialog Enter 제출 구현 Plan

status: in-progress

**Goal:** 새 의도·새 폴더·문서/폴더 이름 변경 dialog에서 유효한 이름을 입력하고 Enter를 누르면 버튼 클릭과 동일하게 제출한다.

**Architecture:** 공유 `NameDialog`를 HTML form으로 만들고 하나의 submit handler에서 trim, 공백, 제출 중 상태를 처리한다. input의 IME 조합 Enter는 기본 동작을 막아 한글 확정 키가 생성 동작으로 이어지지 않게 한다.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library

---

## 계약

- 유효한 단일-line 이름 입력에서 Enter는 현재 submit label의 동작을 실행한다.
- 만들기/이름 변경 button click과 Enter는 같은 form submit 경로를 사용한다.
- trim 결과가 비어 있거나 이미 제출 중이면 제출하지 않는다.
- `KeyboardEvent.isComposing`이 true인 Enter는 제출하지 않는다.
- Escape 취소와 focus 동작은 유지한다.
- 공유 `NameDialog`의 모든 소비자에게 동일하게 적용한다.

## Steps

- [x] `src/components/NameDialog.test.tsx`에 Enter 제출과 IME 보호 회귀 테스트를 작성하고 RED를 확인한다.
- [x] `src/components/NameDialog.tsx`를 공통 form submit 경로로 변경한다.
- [ ] 대상 테스트를 GREEN으로 만들고 전체 test/check/build를 실행한다.
- [ ] 실제 Tauri dialog에서 새 의도 Enter 생성을 확인한다.
- [ ] `DESIGN.md`, `docs/specs/intent-memo.md`, `CLAUDE.md`의 keyboard 계약을 동기화한다.

## 검증 명령

```bash
pnpm test -- src/components/NameDialog.test.tsx
pnpm test
pnpm check
pnpm build
git diff --check
```

commit과 push는 수행하지 않는다.

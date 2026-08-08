import { PanelLeft, PencilLine, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { DocumentList } from "@/components/DocumentList";
import { FolderTree } from "@/components/FolderTree";
import { MarkdownView } from "@/components/MarkdownView";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { TabBar } from "@/components/TabBar";

export function PrimitiveShowcase() {
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const trigger = menuTriggerRef.current;
    if (!trigger) return;
    const bounds = trigger.getBoundingClientRect();
    trigger.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        clientX: bounds.left + 8,
        clientY: bounds.bottom + 4,
      }),
    );
  }, []);

  const folders = [
    { path: "intentions", parent: "", name: "의도" },
    { path: "intentions/weekly", parent: "intentions", name: "주간" },
  ];
  const documents = [
    {
      path: "intentions/weekly/direction.md",
      parent: "intentions/weekly",
      title: "이번 주에 지키려는 방향",
      updatedMs: Date.parse("2026-08-02T13:40:00+09:00"),
    },
  ];
  const noAction = () => {};

  return (
    <main className="showcase">
      <header className="showcase-header">
        <p>Tasteful Intent design system</p>
        <h1>조용한 크롬, 선명한 의도</h1>
        <span>Primitive states · responsive shell · 한국어 조판</span>
      </header>
      <section className="showcase-grid" aria-label="Primitive showcase">
        <article className="showcase-card">
          <h2>Controls</h2>
          <div className="showcase-row">
            <button className="icon-button" aria-label="새 메모" type="button">
              <Plus size={15} />
            </button>
            <button className="text-button" type="button">
              취소
            </button>
            <button className="primary-button" type="button">
              저장
            </button>
            <button
              className="icon-button danger"
              aria-label="휴지통으로 이동"
              type="button"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <fieldset className="mode-switch">
            <legend className="sr-only">편집 모드</legend>
            <button aria-pressed="true" type="button">
              Edit
            </button>
            <button aria-pressed="false" type="button">
              View
            </button>
          </fieldset>
        </article>
        <article className="showcase-card">
          <h2>Rows</h2>
          <FolderTree
            folders={folders}
            rootName="intentions"
            selectedPath="intentions/weekly"
            onMove={noAction}
            onRename={noAction}
            onSelect={noAction}
            onTrash={noAction}
          />
          <DocumentList
            documents={documents}
            snippets={
              new Map([
                [documents[0].path, "AI 요청 전에 목적과 제약을 먼저 적는다."],
              ])
            }
            selectedPath={documents[0].path}
            onMove={noAction}
            onRename={noAction}
            onSelect={noAction}
            onTrash={noAction}
          />
        </article>
        <article className="showcase-card">
          <h2>Spaces</h2>
          <div className="showcase-space-pair">
            <div data-space="intent">
              <SpaceSwitcher
                activeSpace="intent"
                groupName="showcase-human-space"
                root="/Users/me/memo/intents"
                onChange={async () => {}}
              />
            </div>
            <div data-space="docs">
              <SpaceSwitcher
                activeSpace="docs"
                groupName="showcase-ai-space"
                root="/Users/me/projects/ai-results"
                onChange={async () => {}}
              />
            </div>
          </div>
        </article>
        <article className="showcase-card">
          <h2>Tabs</h2>
          <TabBar
            activePath="intent.md"
            documents={[
              showcaseDocument("intent.md", "Intent", "dirty"),
              showcaseDocument("reference.md", "Reference", "error"),
            ]}
            leadingAction={
              <button
                aria-label="Pane layout 변경"
                className="icon-button header-cycle-button layout-cycle-button"
                type="button"
              >
                <PanelLeft aria-hidden="true" size={16} />
              </button>
            }
            onClose={async () => {}}
            onSelect={() => {}}
            trailingActions={
              <button
                aria-label="현재 Edit · 클릭하면 View"
                className="icon-button header-cycle-button mode-cycle-button"
                type="button"
              >
                <PencilLine aria-hidden="true" size={16} />
              </button>
            }
          />
        </article>
        <article className="showcase-card">
          <h2>Context menu</h2>
          <ContextMenu
            items={[
              { id: "rename", label: "Rename…", onSelect: () => {} },
              { id: "move", label: "Move…", onSelect: () => {} },
              {
                id: "trash",
                label: "Move to Trash",
                danger: true,
                onSelect: () => {},
              },
            ]}
            label="Showcase menu"
          >
            {(triggerProps) => (
              <button
                className="text-button"
                type="button"
                {...triggerProps}
                ref={(element) => {
                  triggerProps.ref(element);
                  menuTriggerRef.current = element;
                }}
              >
                우클릭 또는 ⇧F10
              </button>
            )}
          </ContextMenu>
        </article>
        <article className="showcase-card">
          <h2>Notice</h2>
          <div className="inline-notice" role="alert">
            <span>파일이 외부에서 변경되어 자동 저장하지 않았습니다.</span>
            <button
              className="icon-button"
              aria-label="알림 닫기"
              type="button"
            >
              ×
            </button>
          </div>
          <p className="pane-empty">이 폴더에는 Markdown 메모가 없습니다.</p>
        </article>
        <article className="showcase-card showcase-prose">
          <h2>Rendered Markdown</h2>
          <MarkdownView
            body={
              "# 나의 의도\n\nAI 시대에도 **내가 결정한 방향**을 먼저 기록한다.\n\n- 생각을 적는다\n- 선택의 이유를 남긴다"
            }
          />
        </article>
      </section>
    </main>
  );
}

function showcaseDocument(
  path: string,
  title: string,
  saveStatus: "dirty" | "error",
) {
  return {
    path,
    title,
    created: "2026-08-05T00:00:00.000Z",
    updated: "2026-08-05T00:00:00.000Z",
    body: "",
    mtimeMs: 1,
    mode: "edit" as const,
    saveStatus,
  };
}

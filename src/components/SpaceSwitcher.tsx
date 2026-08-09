import {
  Bot,
  Brain,
  ChevronRight,
  Folder,
  MoveLeft,
  MoveRight,
} from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatRootDisplay } from "@/lib/rootDisplay";
import type { Space } from "@/types/library";

type SpaceSwitcherProps = {
  readonly activeSpace: Space;
  readonly compact?: boolean;
  readonly groupName?: string;
  readonly root?: string | null;
  readonly onChange: (space: Space) => Promise<void>;
  readonly onRootChange?: () => void;
};

const spaceCopy = {
  intent: { label: "Human", icon: Brain },
  docs: { label: "AI", icon: Bot },
} as const;

const spaces = ["intent", "docs"] as const;

export function SpaceSwitcher({
  activeSpace,
  compact = false,
  groupName,
  root,
  onChange,
  onRootChange,
}: SpaceSwitcherProps) {
  const messages = useI18n();
  const generatedGroupName = useId();
  const radioGroupName = groupName ?? generatedGroupName;
  const [switching, setSwitching] = useState(false);
  const optionRefs = useRef<Record<Space, HTMLInputElement | null>>({
    intent: null,
    docs: null,
  });

  const selectSpace = async (space: Space) => {
    if (space === activeSpace || switching) return;
    setSwitching(true);
    await onChange(space).finally(() => setSwitching(false));
  };

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = spaces.indexOf(activeSpace);
    const nextIndex =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (currentIndex + 1) % spaces.length
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (currentIndex - 1 + spaces.length) % spaces.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? spaces.length - 1
              : null;
    if (nextIndex == null) return;
    event.preventDefault();
    const nextSpace = spaces[nextIndex];
    optionRefs.current[nextSpace]?.focus();
    void selectSpace(nextSpace);
  };

  if (compact) {
    const current = spaceCopy[activeSpace];
    const targetSpace = activeSpace === "intent" ? "docs" : "intent";
    const Icon = current.icon;
    return (
      <button
        aria-label={messages.space.switchTo(spaceCopy[targetSpace].label)}
        className="space-switcher-compact"
        disabled={switching}
        onClick={() => void selectSpace(targetSpace)}
        type="button"
      >
        <Icon aria-hidden="true" size={14} />
        <span>{current.label}</span>
      </button>
    );
  }

  const rootDisplay = root == null ? null : formatRootDisplay(root);
  const rootActionLabel = root ? messages.space.rootAction(root) : undefined;
  const FlowIcon = activeSpace === "intent" ? MoveRight : MoveLeft;

  return (
    <div className="space-switcher">
      <div
        aria-label={messages.space.groupLabel}
        className="space-segments"
        onKeyDown={handleGroupKeyDown}
        role="radiogroup"
      >
        {spaces.map((space, index) => {
          const entry = spaceCopy[space];
          const Icon = entry.icon;
          return (
            <div className="space-segment-slot" key={space}>
              {index > 0 && (
                <FlowIcon
                  aria-hidden="true"
                  className="space-flow-arrow"
                  size={13}
                />
              )}
              <label className="space-segment-option">
                <input
                  aria-checked={activeSpace === space}
                  checked={activeSpace === space}
                  className="sr-only"
                  name={radioGroupName}
                  onChange={() => void selectSpace(space)}
                  ref={(node) => {
                    optionRefs.current[space] = node;
                  }}
                  tabIndex={activeSpace === space ? 0 : -1}
                  type="radio"
                  value={space}
                />
                {space === "intent" ? (
                  <>
                    <span>{entry.label}</span>
                    <Icon aria-hidden="true" size={14} />
                  </>
                ) : (
                  <>
                    <Icon aria-hidden="true" size={14} />
                    <span>{entry.label}</span>
                  </>
                )}
              </label>
            </div>
          );
        })}
      </div>
      {rootDisplay && (
        <div className="human-source-card source-card">
          <div className="source-card-label">Tasteful Intent Library</div>
          <button
            aria-label={rootActionLabel}
            className="root-row"
            onClick={onRootChange}
            title={rootActionLabel}
            type="button"
          >
            <Folder aria-hidden="true" className="root-row-icon" size={13} />
            <span className="root-path">
              <span className="root-parent">{rootDisplay.parent}</span>
              <span className="root-leaf">{rootDisplay.leaf}</span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="root-row-icon"
              size={13}
            />
          </button>
        </div>
      )}
    </div>
  );
}

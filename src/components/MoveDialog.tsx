import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export type MoveDestination = {
  readonly name: string;
  readonly path: string;
};

type MoveDialogProps = {
  readonly destinations: readonly MoveDestination[];
  readonly onCancel: () => void;
  readonly onSubmit: (destination: string) => Promise<void>;
  readonly open: boolean;
  readonly title: string;
};

export function MoveDialog({
  destinations,
  onCancel,
  onSubmit,
  open,
  title,
}: MoveDialogProps) {
  const messages = useI18n();
  const [destinationIndex, setDestinationIndex] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const titleId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!open) return;
    setDestinationIndex(null);
    selectRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="name-dialog move-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
            return;
          }
          if (event.key !== "Tab") return;

          const focusableElements =
            event.currentTarget.querySelectorAll<HTMLElement>(
              "select:not(:disabled), button:not(:disabled)",
            );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          if (!firstElement || !lastElement) return;

          if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          } else if (
            !event.shiftKey &&
            document.activeElement === lastElement
          ) {
            event.preventDefault();
            firstElement.focus();
          }
        }}
        role="dialog"
      >
        <h2 id={titleId}>{title}</h2>
        <label htmlFor={`${titleId}-destination`}>
          {messages.dialogs.moveFolderLabel}
        </label>
        <select
          id={`${titleId}-destination`}
          onChange={(event) =>
            setDestinationIndex(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
          ref={selectRef}
          value={destinationIndex ?? ""}
        >
          <option value="">{messages.dialogs.selectDestination}</option>
          {destinations.map((entry, index) => (
            <option key={entry.path || "root"} value={index}>
              {entry.name}
            </option>
          ))}
        </select>
        <div className="dialog-actions">
          <button className="text-button" onClick={onCancel} type="button">
            {messages.dialogs.cancel}
          </button>
          <button
            className="primary-button"
            disabled={submitting || destinationIndex === null}
            onClick={() => {
              if (destinationIndex === null) return;
              const destination = destinations[destinationIndex];
              if (!destination) return;
              setSubmitting(true);
              onSubmit(destination.path).finally(() => setSubmitting(false));
            }}
            type="button"
          >
            {messages.dialogs.move}
          </button>
        </div>
      </section>
    </div>
  );
}

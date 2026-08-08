import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type NameDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly label: string;
  readonly initialValue?: string;
  readonly submitLabel: string;
  readonly onCancel: () => void;
  readonly onSubmit: (value: string) => Promise<void>;
};

export function NameDialog({
  open,
  title,
  label,
  initialValue = "",
  submitLabel,
  onCancel,
  onSubmit,
}: NameDialogProps) {
  const messages = useI18n();
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      inputRef.current?.focus();
    }
  }, [initialValue, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <section
        aria-labelledby={`${inputId}-title`}
        aria-modal="true"
        className="name-dialog"
        role="dialog"
      >
        <h2 id={`${inputId}-title`}>{title}</h2>
        <label htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
          ref={inputRef}
          value={value}
        />
        <div className="dialog-actions">
          <button className="text-button" onClick={onCancel} type="button">
            {messages.dialogs.cancel}
          </button>
          <button
            className="primary-button"
            disabled={submitting || value.trim().length === 0}
            onClick={() => {
              setSubmitting(true);
              onSubmit(value.trim()).finally(() => setSubmitting(false));
            }}
            type="button"
          >
            {submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

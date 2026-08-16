import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

type NameDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly label: string;
  readonly initialValue?: string;
  readonly submitLabel: string;
  readonly validate?: (value: string) => string | null;
  readonly validationMessage?: string;
  readonly onCancel: () => void;
  readonly onSubmit: (value: string) => Promise<void>;
};

export function NameDialog({
  open,
  title,
  label,
  initialValue = "",
  submitLabel,
  validate,
  validationMessage,
  onCancel,
  onSubmit,
}: NameDialogProps) {
  const messages = useI18n();
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const validatedValue = validate
    ? validate(value)
    : value.trim().length > 0
      ? value.trim()
      : null;
  const showValidationError =
    Boolean(validationMessage) && value.trim().length > 0 && !validatedValue;

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      inputRef.current?.focus();
    }
  }, [initialValue, open]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <form
        aria-labelledby={`${inputId}-title`}
        aria-modal="true"
        className="name-dialog"
        onSubmit={async (event) => {
          event.preventDefault();
          if (submitting || !validatedValue) return;
          setSubmitting(true);
          try {
            await onSubmit(validatedValue);
          } catch (cause) {
            reportError(cause);
          } finally {
            setSubmitting(false);
          }
        }}
        role="dialog"
      >
        <h2 id={`${inputId}-title`}>{title}</h2>
        <label htmlFor={inputId}>{label}</label>
        <input
          aria-describedby={
            showValidationError ? `${inputId}-error` : undefined
          }
          aria-invalid={showValidationError}
          id={inputId}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
            if (event.key === "Enter" && event.nativeEvent.isComposing) {
              event.preventDefault();
            }
          }}
          ref={inputRef}
          value={value}
        />
        {showValidationError ? (
          <p className="name-dialog-error" id={`${inputId}-error`}>
            {validationMessage}
          </p>
        ) : null}
        <div className="dialog-actions">
          <button className="text-button" onClick={onCancel} type="button">
            {messages.dialogs.cancel}
          </button>
          <button
            className="primary-button"
            disabled={submitting || !validatedValue}
            type="submit"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

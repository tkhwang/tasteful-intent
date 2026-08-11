import { Languages, Monitor, Type as TypeIcon, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Language, SpacePalette, WritingFont } from "@/types/library";
import {
  SPACE_PALETTES,
  THEMES,
  type Theme,
  WRITING_FONTS,
} from "@/types/library";

type SettingsDialogProps = {
  readonly open: boolean;
  readonly spacePalette: SpacePalette;
  readonly theme: Theme;
  readonly language: Language;
  readonly writingFont: WritingFont;
  readonly onClose: () => void;
  readonly onLanguageChange: (language: Language) => void;
  readonly onSpacePaletteChange: (palette: SpacePalette) => void;
  readonly onThemeChange: (theme: Theme) => void;
  readonly onWritingFontChange: (font: WritingFont) => void;
};

type SettingsSection = "appearance" | "typography" | "language";

export function SettingsDialog({
  open,
  spacePalette,
  theme,
  language,
  writingFont,
  onClose,
  onLanguageChange,
  onSpacePaletteChange,
  onThemeChange,
  onWritingFontChange,
}: SettingsDialogProps) {
  const messages = useI18n();
  const titleId = useId();
  const [section, setSection] = useState<SettingsSection>("appearance");
  const selectedThemeRef = useRef<HTMLInputElement>(null);
  const selectedWritingFontRef = useRef<HTMLInputElement>(null);
  const selectedLanguageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setSection("appearance");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (section === "appearance") selectedThemeRef.current?.focus();
    if (section === "typography") selectedWritingFontRef.current?.focus();
    if (section === "language") selectedLanguageRef.current?.focus();
  }, [open, section]);

  if (!open) return null;

  return (
    <div className="dialog-backdrop">
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="name-dialog settings-dialog"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
          }
          if (event.key !== "Tab") return;

          const focusableElements =
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), input:not(:disabled):not([type='radio']), input[type='radio']:checked:not(:disabled)",
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
        <aside
          className="settings-navigation"
          aria-label={messages.settings.navigationLabel}
        >
          <h2 id={titleId}>{messages.settings.title}</h2>
          <button
            aria-current={section === "appearance" ? "page" : undefined}
            onClick={() => setSection("appearance")}
            type="button"
          >
            <Monitor aria-hidden="true" size={15} />
            {messages.settings.appearance}
          </button>
          <button
            aria-current={section === "typography" ? "page" : undefined}
            onClick={() => setSection("typography")}
            type="button"
          >
            <TypeIcon aria-hidden="true" size={15} />
            {messages.settings.typography}
          </button>
          <button
            aria-current={section === "language" ? "page" : undefined}
            onClick={() => setSection("language")}
            type="button"
          >
            <Languages aria-hidden="true" size={15} />
            {messages.settings.language}
          </button>
        </aside>
        <div className="settings-content">
          <div className="settings-content-header">
            <div>
              <p>
                {section === "appearance" && messages.settings.appearance}
                {section === "typography" && messages.settings.typography}
                {section === "language" && messages.settings.language}
              </p>
              <h3>
                {section === "appearance" && messages.settings.appearanceTitle}
                {section === "typography" && messages.settings.typographyTitle}
                {section === "language" && messages.settings.languageTitle}
              </h3>
            </div>
            <button
              aria-label={messages.settings.close}
              className="icon-button"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
          {section === "appearance" ? (
            <>
              <fieldset className="theme-tiles">
                <legend>{messages.settings.theme}</legend>
                <div className="theme-tile-grid">
                  {THEMES.map((option) => (
                    <label className="theme-tile" key={option}>
                      <input
                        checked={theme === option}
                        name="theme"
                        onChange={() => onThemeChange(option)}
                        ref={theme === option ? selectedThemeRef : undefined}
                        type="radio"
                        value={option}
                      />
                      <span
                        aria-hidden="true"
                        className="theme-tile-preview"
                        data-preview-theme={option}
                      >
                        <span className="theme-preview-sidebar" />
                        <span className="theme-preview-list" />
                        <span className="theme-preview-content" />
                      </span>
                      <span className="theme-tile-label">
                        <span>{messages.settings.themeLabels[option]}</span>
                        <span className="theme-tile-radio" aria-hidden="true" />
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="theme-tiles palette-tiles">
                <legend>{messages.settings.spacePalette}</legend>
                <div className="theme-tile-grid">
                  {SPACE_PALETTES.map((option) => (
                    <label className="theme-tile" key={option}>
                      <input
                        checked={spacePalette === option}
                        name="space-palette"
                        onChange={() => onSpacePaletteChange(option)}
                        type="radio"
                        value={option}
                      />
                      <span
                        aria-hidden="true"
                        className="palette-tile-preview"
                        data-space-palette={option}
                      >
                        <span className="palette-swatch-human" />
                        <span className="palette-swatch-ai" />
                      </span>
                      <span className="theme-tile-label">
                        <span>
                          {messages.settings.spacePaletteLabels[option]}
                        </span>
                        <span className="theme-tile-radio" aria-hidden="true" />
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : section === "typography" ? (
            <fieldset className="settings-choice-fieldset">
              <legend>{messages.settings.writingFont}</legend>
              <div className="settings-choice-grid">
                {WRITING_FONTS.map((option) => {
                  const isSans = option === "sans";
                  const label = isSans
                    ? messages.settings.sansSerif
                    : messages.settings.serif;
                  return (
                    <label className="settings-choice-card" key={option}>
                      <input
                        aria-label={label}
                        checked={writingFont === option}
                        name="writing-font"
                        onChange={() => onWritingFontChange(option)}
                        ref={
                          writingFont === option
                            ? selectedWritingFontRef
                            : undefined
                        }
                        type="radio"
                        value={option}
                      />
                      <span
                        aria-hidden="true"
                        className="settings-choice-glyph"
                        data-writing-font={option}
                      >
                        Aa 가
                      </span>
                      <span className="settings-choice-copy">
                        <strong>{label}</strong>
                        <small>
                          {isSans
                            ? messages.settings.sansSerifNote
                            : messages.settings.serifNote}
                        </small>
                      </span>
                      <span
                        className="settings-choice-radio"
                        aria-hidden="true"
                      />
                    </label>
                  );
                })}
              </div>
              <div
                className="settings-live-preview settings-font-preview"
                data-writing-font={writingFont}
              >
                <span className="settings-preview-label">
                  {messages.settings.preview}
                </span>
                <strong>{messages.settings.fontPreviewTitle}</strong>
                <p>{messages.settings.fontPreviewBody}</p>
              </div>
              <p className="settings-help">{messages.settings.fontHelp}</p>
            </fieldset>
          ) : (
            <fieldset className="settings-choice-fieldset">
              <legend>{messages.settings.appLanguage}</legend>
              <div className="settings-choice-grid">
                <label className="settings-choice-card">
                  <input
                    aria-label={messages.settings.english}
                    checked={language === "en"}
                    name="language"
                    onChange={() => onLanguageChange("en")}
                    ref={language === "en" ? selectedLanguageRef : undefined}
                    type="radio"
                    value="en"
                  />
                  <span aria-hidden="true" className="settings-choice-glyph">
                    EN
                  </span>
                  <span className="settings-choice-copy">
                    <strong>{messages.settings.english}</strong>
                    <small>{messages.settings.englishNote}</small>
                  </span>
                  <span className="settings-choice-radio" aria-hidden="true" />
                </label>
                <label className="settings-choice-card">
                  <input
                    aria-label={messages.settings.korean}
                    checked={language === "ko"}
                    name="language"
                    onChange={() => onLanguageChange("ko")}
                    ref={language === "ko" ? selectedLanguageRef : undefined}
                    type="radio"
                    value="ko"
                  />
                  <span aria-hidden="true" className="settings-choice-glyph">
                    한
                  </span>
                  <span className="settings-choice-copy">
                    <strong>{messages.settings.korean}</strong>
                    <small>{messages.settings.koreanNote}</small>
                  </span>
                  <span className="settings-choice-radio" aria-hidden="true" />
                </label>
              </div>
              <div className="settings-live-preview settings-language-preview">
                <span className="settings-preview-label">
                  {messages.settings.preview}
                </span>
                <strong>{messages.app.newIntent}</strong>
                <p>
                  {messages.app.intentEmptyLead} {messages.app.intentEmptyTail}
                </p>
                <div aria-hidden="true" className="settings-preview-actions">
                  <span>{messages.dialogs.cancel}</span>
                  <span>{messages.dialogs.create}</span>
                </div>
              </div>
              <p className="settings-help">{messages.settings.languageHelp}</p>
            </fieldset>
          )}
        </div>
      </section>
    </div>
  );
}

import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Language, SpacePalette, Theme } from "@/types/library";
import { LANGUAGES, SPACE_PALETTES, THEMES } from "@/types/library";

type OnboardingScreenProps = {
  readonly language: Language;
  readonly spacePalette: SpacePalette;
  readonly theme: Theme;
  readonly onLanguageChange: (language: Language) => void;
  readonly onSpacePaletteChange: (palette: SpacePalette) => void;
  readonly onThemeChange: (theme: Theme) => void;
  readonly onComplete: (libraryRoot: string) => void;
};

const TOTAL_STEPS = 3;

export function OnboardingScreen({
  language,
  spacePalette,
  theme,
  onLanguageChange,
  onSpacePaletteChange,
  onThemeChange,
  onComplete,
}: OnboardingScreenProps) {
  const messages = useI18n();
  const [step, setStep] = useState(0);
  const initializedStepsRef = useRef(new Set<number>());
  const languageFocusRef = useRef<HTMLInputElement>(null);
  const themeFocusRef = useRef<HTMLInputElement>(null);
  const humanFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (initializedStepsRef.current.has(step)) return;
    initializedStepsRef.current.add(step);
    if (step === 0) onLanguageChange("en");
    if (step === 1) onThemeChange("charcoal");
  }, [onLanguageChange, onThemeChange, step]);

  useEffect(() => {
    const target =
      step === 0
        ? languageFocusRef.current
        : step === 1
          ? themeFocusRef.current
          : humanFocusRef.current;
    target?.focus();
  }, [step]);

  const chooseRoot = async (title: string): Promise<string | null> => {
    const selected = await open({ title, directory: true, multiple: false });
    return typeof selected === "string" ? selected : null;
  };

  const chooseHumanRoot = async () => {
    const selected = await chooseRoot(messages.app.chooseIntentRoot);
    if (!selected) return;
    onComplete(selected);
  };

  return (
    <main className="welcome-screen onboarding-screen">
      <div className="onboarding-card">
        <p className="onboarding-step">
          {messages.onboarding.step(step + 1, TOTAL_STEPS)}
        </p>
        {step === 0 ? (
          <>
            <h1>{messages.onboarding.languageTitle}</h1>
            <p className="onboarding-body">
              {messages.onboarding.languageBody}
            </p>
            <fieldset className="settings-choice-fieldset onboarding-choices">
              <legend className="sr-only">
                {messages.settings.appLanguage}
              </legend>
              <div className="settings-choice-grid">
                {LANGUAGES.map((option) => {
                  const isEnglish = option === "en";
                  return (
                    <label className="settings-choice-card" key={option}>
                      <input
                        aria-label={
                          isEnglish
                            ? messages.settings.english
                            : messages.settings.korean
                        }
                        checked={language === option}
                        name="onboarding-language"
                        onChange={() => onLanguageChange(option)}
                        ref={language === option ? languageFocusRef : undefined}
                        type="radio"
                        value={option}
                      />
                      <span
                        aria-hidden="true"
                        className="settings-choice-glyph"
                      >
                        {isEnglish ? "EN" : "가"}
                      </span>
                      <span className="settings-choice-copy">
                        <strong>
                          {isEnglish
                            ? messages.settings.english
                            : messages.settings.korean}
                        </strong>
                        <small>
                          {isEnglish
                            ? messages.settings.englishNote
                            : messages.settings.koreanNote}
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
            </fieldset>
          </>
        ) : null}
        {step === 1 ? (
          <>
            <h1>{messages.onboarding.themeTitle}</h1>
            <p className="onboarding-body">{messages.onboarding.themeBody}</p>
            <fieldset className="theme-tiles onboarding-choices">
              <legend className="sr-only">{messages.settings.theme}</legend>
              <div className="theme-tile-grid">
                {THEMES.map((option) => (
                  <label className="theme-tile" key={option}>
                    <input
                      checked={theme === option}
                      name="onboarding-theme"
                      onChange={() => onThemeChange(option)}
                      ref={theme === option ? themeFocusRef : undefined}
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
            <fieldset className="theme-tiles onboarding-choices palette-tiles">
              <legend>{messages.settings.spacePalette}</legend>
              <div className="theme-tile-grid">
                {SPACE_PALETTES.map((option) => (
                  <label className="theme-tile" key={option}>
                    <input
                      checked={spacePalette === option}
                      name="onboarding-space-palette"
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
        ) : null}
        {step === 2 ? (
          <>
            <h1>{messages.onboarding.humanTitle}</h1>
            <p className="onboarding-body">{messages.onboarding.humanBody}</p>
            <button
              className="primary-button welcome-action onboarding-folder-action"
              onClick={() => void chooseHumanRoot()}
              ref={humanFocusRef}
              type="button"
            >
              {messages.app.chooseIntentRoot}
            </button>
          </>
        ) : null}
        <div className="onboarding-navigation">
          {step > 0 ? (
            <button
              className="text-button"
              onClick={() => setStep((current) => current - 1)}
              type="button"
            >
              {messages.onboarding.back}
            </button>
          ) : (
            <span />
          )}
          <div>
            {step < 2 ? (
              <button
                className="text-button"
                onClick={() => {
                  if (step === 0) onLanguageChange("en");
                  if (step === 1) {
                    onThemeChange("charcoal");
                    onSpacePaletteChange("classic");
                  }
                  setStep((current) => current + 1);
                }}
                type="button"
              >
                {messages.onboarding.skip}
              </button>
            ) : null}
            {step < 2 ? (
              <button
                className="primary-button"
                onClick={() => setStep((current) => current + 1)}
                type="button"
              >
                {messages.onboarding.continue}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

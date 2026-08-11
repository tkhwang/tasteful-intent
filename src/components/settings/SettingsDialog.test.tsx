// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog } from "@/components/settings/SettingsDialog";

afterEach(cleanup);

describe("SettingsDialog", () => {
  it("separates Appearance, Typography, and Language navigation", () => {
    // Given: Settings opens in English with Two-Tone selected.
    render(
      <SettingsDialog
        language="en"
        open
        spacePalette="classic"
        theme="charcoal"
        writingFont="sans"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
        onSpacePaletteChange={vi.fn()}
        onThemeChange={vi.fn()}
        onWritingFontChange={vi.fn()}
      />,
    );

    // Then: Appearance owns the four-option theme radio group.
    expect(screen.getByRole("button", { name: "Appearance" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Typography" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Language" })).toBeDefined();
    expect(screen.getByRole("group", { name: "Theme" })).toBeDefined();
    expect(
      screen.getByRole("group", { name: "Human & AI colors" }),
    ).toBeDefined();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(
      (screen.getByRole("radio", { name: "Two-Tone" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("focuses the current theme and applies a new selection immediately", () => {
    const onThemeChange = vi.fn();

    // Given: Settings opens with Light selected.
    render(
      <SettingsDialog
        language="en"
        open
        spacePalette="classic"
        theme="light"
        writingFont="sans"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
        onSpacePaletteChange={vi.fn()}
        onThemeChange={onThemeChange}
        onWritingFontChange={vi.fn()}
      />,
    );

    // When: the dialog opens and Two-Tone is selected.
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Light" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Two-Tone" }));

    // Then: selection is handed to the app immediately.
    expect(onThemeChange).toHaveBeenCalledWith("charcoal");
  });

  it("applies a Human and AI color palette without changing the theme", () => {
    const onSpacePaletteChange = vi.fn();
    const onThemeChange = vi.fn();
    render(
      <SettingsDialog
        language="en"
        open
        spacePalette="classic"
        theme="light"
        writingFont="sans"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
        onSpacePaletteChange={onSpacePaletteChange}
        onThemeChange={onThemeChange}
        onWritingFontChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Plum & Moss" }));

    expect(onSpacePaletteChange).toHaveBeenCalledWith("plum-moss");
    expect(onThemeChange).not.toHaveBeenCalled();
  });

  it("shows two writing font cards and applies Serif immediately", () => {
    const onWritingFontChange = vi.fn();
    const { container } = render(
      <SettingsDialog
        language="en"
        open
        spacePalette="classic"
        theme="light"
        writingFont="sans"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
        onSpacePaletteChange={vi.fn()}
        onThemeChange={vi.fn()}
        onWritingFontChange={onWritingFontChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Typography" }));

    expect(screen.getByRole("group", { name: "Writing font" })).toBeDefined();
    expect(container.querySelectorAll(".settings-choice-card")).toHaveLength(2);
    expect(
      (screen.getByRole("radio", { name: "Sans-serif" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "Serif" }));
    expect(onWritingFontChange).toHaveBeenCalledWith("serif");
    expect(container.querySelector(".settings-live-preview")).not.toBeNull();
  });

  it("shows English and Korean in the Language section", () => {
    const onLanguageChange = vi.fn();
    render(
      <SettingsDialog
        language="en"
        open
        spacePalette="classic"
        theme="light"
        writingFont="sans"
        onClose={vi.fn()}
        onLanguageChange={onLanguageChange}
        onSpacePaletteChange={vi.fn()}
        onThemeChange={vi.fn()}
        onWritingFontChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Language" }));

    expect(screen.getByRole("group", { name: "App language" })).toBeDefined();
    expect(document.querySelectorAll(".settings-choice-card")).toHaveLength(2);
    expect(document.querySelector(".settings-live-preview")).not.toBeNull();
    expect(
      (screen.getByRole("radio", { name: "English" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: "한국어" }));
    expect(onLanguageChange).toHaveBeenCalledWith("ko");
  });

  it("limits generic form styles to direct dialog fields", () => {
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

    expect(css).toContain(".name-dialog > label {");
    expect(css).toContain(".name-dialog > input {");
  });

  it("closes with Escape and traps keyboard focus", () => {
    const onClose = vi.fn();

    // Given: Settings is open.
    render(
      <SettingsDialog
        language="en"
        open
        spacePalette="classic"
        theme="light"
        writingFont="sans"
        onClose={onClose}
        onLanguageChange={vi.fn()}
        onSpacePaletteChange={vi.fn()}
        onThemeChange={vi.fn()}
        onWritingFontChange={vi.fn()}
      />,
    );

    const first = screen.getByRole("button", { name: "Appearance" });
    const last = screen.getByRole("radio", { name: "Classic" });
    const dialog = screen.getByRole("dialog", { name: "Settings" });

    // When/Then: Tab wraps at each edge of the dialog.
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    first.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);

    // When: Escape is pressed.
    fireEvent.keyDown(dialog, { key: "Escape" });

    // Then: the dialog requests closure.
    expect(onClose).toHaveBeenCalledOnce();
  });
});

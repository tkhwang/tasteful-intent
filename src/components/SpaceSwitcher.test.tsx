// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { I18nProvider } from "@/lib/i18n";
import type { Space } from "@/types/library";

afterEach(cleanup);

describe("SpaceSwitcher", () => {
  it("keeps multiple radio groups independent", async () => {
    // Given: two switchers with different controlled active spaces.
    function Harness() {
      const [firstSpace, setFirstSpace] = useState<Space>("intent");
      const [secondSpace, setSecondSpace] = useState<Space>("docs");
      return (
        <>
          <SpaceSwitcher
            activeSpace={firstSpace}
            onChange={async (space) => setFirstSpace(space)}
          />
          <SpaceSwitcher
            activeSpace={secondSpace}
            onChange={async (space) => setSecondSpace(space)}
          />
        </>
      );
    }
    const user = userEvent.setup();
    render(<Harness />);
    const groups = screen.getAllByRole("radiogroup", {
      name: "Choose a space",
    });
    const firstGroup = groups.at(0);
    const secondGroup = groups.at(1);
    if (!firstGroup || !secondGroup) {
      throw new TypeError("Two space switchers are required");
    }
    const firstAI = within(firstGroup).getByRole("radio", { name: /AI/ });
    const secondAI = within(secondGroup).getByRole("radio", { name: /AI/ });
    if (
      !(firstAI instanceof HTMLInputElement) ||
      !(secondAI instanceof HTMLInputElement)
    ) {
      throw new TypeError("Space options must be radio inputs");
    }

    // When: AI is selected in the first switcher.
    await user.click(firstAI);

    // Then: each switcher keeps its own native radio group and active value.
    expect(firstAI.getAttribute("name")).not.toBe(
      secondAI.getAttribute("name"),
    );
    expect(firstAI.checked).toBe(true);
    expect(secondAI.checked).toBe(true);
  });

  it("shows Human and AI as a radio group with the active space", () => {
    const { container } = render(
      <SpaceSwitcher activeSpace="intent" onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("radiogroup", { name: "Choose a space" }),
    ).toBeDefined();
    expect(
      screen.getByRole("radio", { name: /Human/ }).getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen.getByRole("radio", { name: /AI/ }).getAttribute("aria-checked"),
    ).toBe("false");
    expect(container.querySelector(".lucide-brain")).not.toBeNull();
    expect(container.querySelector(".lucide-bot")).not.toBeNull();
    expect(container.querySelector(".lucide-move-right")).not.toBeNull();

    const humanVisibleContent = Array.from(
      screen.getByRole("radio", { name: /Human/ }).closest("label")?.children ??
        [],
    ).filter((child) => child.tagName !== "INPUT");
    const aiVisibleContent = Array.from(
      screen.getByRole("radio", { name: /AI/ }).closest("label")?.children ??
        [],
    ).filter((child) => child.tagName !== "INPUT");
    expect(humanVisibleContent.at(0)?.tagName).toBe("SPAN");
    expect(humanVisibleContent.at(1)?.classList.contains("lucide-brain")).toBe(
      true,
    );
    expect(aiVisibleContent.at(0)?.classList.contains("lucide-bot")).toBe(true);
    expect(aiVisibleContent.at(1)?.tagName).toBe("SPAN");
  });

  it("points the flow arrow from the active AI space back to Human", () => {
    const { container } = render(
      <SpaceSwitcher activeSpace="docs" onChange={vi.fn()} />,
    );
    expect(container.querySelector(".lucide-move-left")).not.toBeNull();
    expect(container.querySelector(".lucide-move-right")).toBeNull();
  });

  it("calls onChange when the inactive space is selected", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<SpaceSwitcher activeSpace="intent" onChange={onChange} />);
    await userEvent.click(screen.getByRole("radio", { name: /AI/ }));
    expect(onChange).toHaveBeenCalledWith("docs");
  });

  it("moves focus and switches with an arrow key", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<SpaceSwitcher activeSpace="intent" onChange={onChange} />);
    screen.getByRole("radio", { name: /Human/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /AI/ })).toBe(
      document.activeElement,
    );
    expect(onChange).toHaveBeenCalledWith("docs");
  });

  it("keeps the focused radio enabled while an async switch is pending", async () => {
    // Given: a space change that remains pending after keyboard selection.
    let resolveChange: () => void = () => undefined;
    const pendingChange = new Promise<void>((resolve) => {
      resolveChange = () => resolve();
    });
    const onChange = vi.fn(() => pendingChange);
    const user = userEvent.setup();
    render(<SpaceSwitcher activeSpace="intent" onChange={onChange} />);
    const human = screen.getByRole("radio", { name: /Human/ });
    const ai = screen.getByRole("radio", { name: /AI/ });
    if (
      !(human instanceof HTMLInputElement) ||
      !(ai instanceof HTMLInputElement)
    ) {
      throw new TypeError("Space options must be radio inputs");
    }
    human.focus();

    // When: keyboard navigation starts the asynchronous switch.
    await user.keyboard("{ArrowRight}");

    try {
      // Then: focus remains on an enabled radio and re-selection is ignored.
      expect(ai).toBe(document.activeElement);
      expect(ai.disabled).toBe(false);
      await user.click(ai);
      expect(onChange).toHaveBeenCalledTimes(1);
    } finally {
      await act(async () => {
        resolveChange();
        await pendingChange;
      });
    }
  });

  it("shows the active label and target label in compact mode", () => {
    render(<SpaceSwitcher activeSpace="docs" compact onChange={vi.fn()} />);
    const button = screen.getByRole("button", {
      name: "Switch to Human space",
    });
    expect(button.textContent).toContain("AI");
  });

  it("shows the current Markdown location as a folder-picker path", async () => {
    // Given: a deep root whose full path identifies the Markdown location.
    const onRootChange = vi.fn();
    const { container } = render(
      <SpaceSwitcher
        activeSpace="intent"
        onChange={vi.fn()}
        onRootChange={onRootChange}
        root="/Users/x/memo/intents"
      />,
    );

    // When: the compact location control is rendered.
    const row = screen.getByRole("button", {
      name: "Current Markdown location: /Users/x/memo/intents. Click to choose another folder",
    });

    // Then: semantic icons flank one continuous path and explain the action.
    expect(row.title).toBe(
      "Current Markdown location: /Users/x/memo/intents. Click to choose another folder",
    );
    expect(container.querySelector(".root-row .lucide-folder")).not.toBeNull();
    expect(
      container.querySelector(".root-row .lucide-chevron-right"),
    ).not.toBeNull();
    expect(container.querySelector(".root-row .lucide-pencil")).toBeNull();
    expect(container.querySelector(".root-path")?.textContent).toBe(
      "…/memo/intents",
    );
    expect(container.querySelector(".root-path")?.children).toHaveLength(2);

    await userEvent.click(row);
    expect(onRootChange).toHaveBeenCalledTimes(1);
  });

  it("uses a two-row source card with the Tasteful Intent Library label", () => {
    // Given: Human space has a selected Markdown library root.
    const { container } = render(
      <SpaceSwitcher
        activeSpace="intent"
        onChange={vi.fn()}
        onRootChange={vi.fn()}
        root="/Users/x/memo/intents"
      />,
    );

    // Then: the stable source card keeps the workspace label above the picker.
    const sourceCard = container.querySelector(".source-card");
    const rootPicker = screen.getByRole("button", {
      name: "Current Markdown location: /Users/x/memo/intents. Click to choose another folder",
    });
    expect(sourceCard?.children).toHaveLength(2);
    expect(sourceCard?.children.item(0)?.textContent).toBe(
      "Tasteful Intent Library",
    );
    expect(sourceCard?.children.item(1)).toBe(rootPicker);
  });

  it("localizes Library without translating the Tasteful Intent product name", () => {
    // Given: the Human source card is rendered in Korean.
    const { container } = render(
      <I18nProvider language="ko">
        <SpaceSwitcher
          activeSpace="intent"
          onChange={vi.fn()}
          onRootChange={vi.fn()}
          root="/Users/x/memo/intents"
        />
      </I18nProvider>,
    );

    // Then: only the Library portion of the source-card label is localized.
    expect(container.querySelector(".source-card-label")?.textContent).toBe(
      "Tasteful Intent 라이브러리",
    );
  });
});

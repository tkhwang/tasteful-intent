// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocsRootSwitcher } from "@/components/DocsRootSwitcher";

afterEach(() => cleanup());

describe("DocsRootSwitcher", () => {
  it("shows one Browse root without generated shortcuts", async () => {
    const user = userEvent.setup();
    const onOpenFolder = vi.fn();
    const { container } = render(
      <DocsRootSwitcher
        leadingControl={<button type="button">Browse</button>}
        onOpenFolder={onOpenFolder}
        root="/work/current"
      />,
    );

    expect(container.querySelectorAll(".docs-root-shortcut")).toHaveLength(0);
    expect(screen.getByText("/work/current")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Open AI folder" }));
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });
});

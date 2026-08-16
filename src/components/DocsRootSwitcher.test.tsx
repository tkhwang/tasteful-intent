// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocsRootSwitcher } from "@/components/DocsRootSwitcher";

afterEach(() => cleanup());

describe("DocsRootSwitcher", () => {
  it("shows closeable Browse folder tabs separately from the open action", async () => {
    const user = userEvent.setup();
    const onOpenFolder = vi.fn();
    const onSelect = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <DocsRootSwitcher
        activeRoot="/work/current"
        leadingControl={<button type="button">Browse</button>}
        onClose={onClose}
        onOpenFolder={onOpenFolder}
        onSelect={onSelect}
        roots={["/work/current", "/other/current"]}
      />,
    );

    expect(container.querySelectorAll(".docs-root-shortcut")).toHaveLength(0);
    expect(
      screen.getAllByRole("button", { name: /Open AI folder tab:/ }),
    ).toHaveLength(2);
    await user.click(
      screen.getByRole("button", {
        name: "Open AI folder tab: /other/current",
      }),
    );
    expect(onSelect).toHaveBeenCalledWith("/other/current");
    await user.click(
      screen.getByRole("button", {
        name: "Close AI folder tab: /work/current",
      }),
    );
    expect(onClose).toHaveBeenCalledWith("/work/current");
    await user.click(screen.getByRole("button", { name: "Open AI folder" }));
    expect(onOpenFolder).toHaveBeenCalledOnce();
  });
});

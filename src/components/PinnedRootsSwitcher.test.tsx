// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PinnedRootsSwitcher } from "@/components/PinnedRootsSwitcher";
import type { DocsPinnedRoot } from "@/types/library";

afterEach(() => cleanup());

const roots: readonly DocsPinnedRoot[] = [
  { root: "/work/task-a", label: "TA" },
  { root: "/work/task-b", label: "기획" },
  { root: "/work/task-c", label: "TA" },
];

function renderSwitcher(
  overrides: Partial<React.ComponentProps<typeof PinnedRootsSwitcher>> = {},
) {
  return render(
    <PinnedRootsSwitcher
      activeRoot={roots[0].root}
      leadingControl={<button type="button">Pinned</button>}
      onEditLabel={vi.fn()}
      onPin={vi.fn()}
      onSelect={vi.fn().mockResolvedValue(true)}
      onUnpin={vi.fn().mockResolvedValue(true)}
      roots={roots}
      {...overrides}
    />,
  );
}

describe("PinnedRootsSwitcher", () => {
  it("renders stored duplicate labels without renumbering them", () => {
    renderSwitcher();

    expect(
      screen.getAllByRole("button", { name: /Open pinned folder TA:/ }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", {
        name: "Open pinned folder 기획: /work/task-b",
      }),
    ).toBeDefined();
  });

  it("pins a folder and exposes label editing from the root menu", async () => {
    const user = userEvent.setup();
    const onPin = vi.fn();
    const onEditLabel = vi.fn();
    renderSwitcher({ onEditLabel, onPin });

    await user.click(screen.getByRole("button", { name: "Pin AI folder" }));
    expect(onPin).toHaveBeenCalledOnce();
    await user.click(
      screen.getByRole("button", {
        name: "Show pinned folders for TA: /work/task-a",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Edit label for /work/task-b" }),
    );
    expect(onEditLabel).toHaveBeenCalledWith("/work/task-b");
  });

  it("selects roots and focuses the surviving row after unpin", async () => {
    const user = userEvent.setup();
    const onUnpin = vi.fn().mockResolvedValue(true);
    const { rerender } = renderSwitcher({ onUnpin });
    await user.click(
      screen.getByRole("button", {
        name: "Show pinned folders for TA: /work/task-a",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Unpin /work/task-a" }),
    );
    expect(onUnpin).toHaveBeenCalledWith("/work/task-a");

    rerender(
      <PinnedRootsSwitcher
        activeRoot={roots[1].root}
        leadingControl={<button type="button">Pinned</button>}
        onEditLabel={vi.fn()}
        onPin={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(true)}
        onUnpin={onUnpin}
        roots={roots.slice(1)}
      />,
    );

    const remaining = screen.getByRole("menuitemradio", {
      name: "Open pinned folder 기획: /work/task-b",
    });
    await waitFor(() => expect(document.activeElement).toBe(remaining));
  });

  it("exposes row actions as keyboard-navigable menu items", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(
      screen.getByRole("button", {
        name: "Show pinned folders for TA: /work/task-a",
      }),
    );
    const edit = screen.getByRole("menuitem", {
      name: "Edit label for /work/task-a",
    });
    edit.focus();

    await user.keyboard("{ArrowDown}");

    expect(document.activeElement).toBe(
      screen.getByRole("menuitemradio", {
        name: "Open pinned folder 기획: /work/task-b",
      }),
    );
  });

  it("returns null after the last root is removed", () => {
    const { container, rerender } = renderSwitcher({
      roots: roots.slice(0, 1),
    });

    rerender(
      <PinnedRootsSwitcher
        activeRoot={null}
        leadingControl={<button type="button">Pinned</button>}
        onEditLabel={vi.fn()}
        onPin={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(true)}
        onUnpin={vi.fn().mockResolvedValue(true)}
        roots={[]}
      />,
    );

    expect(container.querySelector(".source-card")).toBeNull();
  });
});

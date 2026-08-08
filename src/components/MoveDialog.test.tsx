// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MoveDialog } from "@/components/MoveDialog";

afterEach(cleanup);

const destinations = [{ name: "Library", path: "" }] as const;

function renderMoveDialog() {
  const onCancel = vi.fn();
  render(
    <>
      <button type="button">Outside before</button>
      <MoveDialog
        destinations={destinations}
        onCancel={onCancel}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        open
        title="Move memo"
      />
      <button type="button">Outside after</button>
    </>,
  );
  return onCancel;
}

const escapeTargets = [
  {
    name: "destination select",
    getControl: () => screen.getByRole("combobox"),
  },
  {
    name: "cancel button",
    getControl: () => screen.getByRole("button", { name: "Cancel" }),
  },
  {
    name: "move button",
    getControl: () => screen.getByRole("button", { name: "Move" }),
  },
] as const;

describe("MoveDialog", () => {
  it.each(escapeTargets)("cancels with Escape from the $name", ({
    getControl,
  }) => {
    const onCancel = renderMoveDialog();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "0" },
    });
    const control = getControl();
    control.focus();

    fireEvent.keyDown(control, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("cycles Tab forward within the dialog", async () => {
    const user = userEvent.setup();
    renderMoveDialog();
    const select = screen.getByRole("combobox");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const move = screen.getByRole("button", { name: "Move" });
    await user.selectOptions(select, "0");
    select.focus();

    await user.tab();
    expect(document.activeElement).toBe(cancel);
    await user.tab();
    expect(document.activeElement).toBe(move);
    await user.tab();
    expect(document.activeElement).toBe(select);
  });

  it("cycles Shift+Tab backward within the dialog", async () => {
    const user = userEvent.setup();
    renderMoveDialog();
    const select = screen.getByRole("combobox");
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const move = screen.getByRole("button", { name: "Move" });
    await user.selectOptions(select, "0");
    select.focus();

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(move);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(cancel);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(select);
  });
});

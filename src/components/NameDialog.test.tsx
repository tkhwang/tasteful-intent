// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NameDialog } from "@/components/NameDialog";

afterEach(cleanup);

function renderNameDialog() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(
    <NameDialog
      label="Intent name"
      onCancel={vi.fn()}
      onSubmit={onSubmit}
      open
      submitLabel="Create"
      title="New Intent"
    />,
  );
  return onSubmit;
}

describe("NameDialog", () => {
  it("submits the trimmed name when Enter is pressed", async () => {
    const user = userEvent.setup();
    const onSubmit = renderNameDialog();

    await user.type(
      screen.getByRole("textbox", { name: "Intent name" }),
      "  test  ",
    );
    await user.keyboard("{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("test"));
  });

  it("prevents an IME composition Enter from submitting", () => {
    const onSubmit = renderNameDialog();
    const input = screen.getByRole("textbox", { name: "Intent name" });
    fireEvent.change(input, { target: { value: "테스트" } });

    const defaultAllowed = fireEvent.keyDown(input, {
      isComposing: true,
      key: "Enter",
    });

    expect(defaultAllowed).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

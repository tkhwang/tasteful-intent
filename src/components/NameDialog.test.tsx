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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderNameDialog(
  onSubmit = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(),
) {
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
  it("disables submission and exposes an error for an invalid optional value", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValue();
    render(
      <NameDialog
        initialValue="AB"
        label="Shortcut label"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
        open
        submitLabel="Save"
        title="Edit label"
        validate={(value: string) => (value.length <= 2 ? value : null)}
        validationMessage="Use one or two characters."
      />,
    );

    const input = screen.getByRole("textbox", { name: "Shortcut label" });
    await user.type(input, "C");

    expect(screen.getByText("Use one or two characters.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      true,
    );
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

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

  it("reports a rejected submission and releases the submitting state", async () => {
    // Given
    const user = userEvent.setup();
    const failure = new Error("Create failed");
    let rejectSubmission: (reason?: unknown) => void = () => {
      throw new Error("Submission rejection was not initialized");
    };
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          rejectSubmission = reject;
        }),
    );
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    renderNameDialog(onSubmit);
    const input = screen.getByRole("textbox", { name: "Intent name" });
    const submit = screen.getByRole("button", { name: "Create" });
    await user.type(input, "test");

    // When
    await user.click(submit);
    expect(submit).toHaveProperty("disabled", true);
    rejectSubmission(failure);

    // Then
    await waitFor(() => expect(report).toHaveBeenCalledWith(failure));
    expect(submit).toHaveProperty("disabled", false);
  });
});

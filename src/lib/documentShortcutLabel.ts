export const documentShortcutLabel = (index: number) =>
  index < 26
    ? String.fromCharCode("A".charCodeAt(0) + index)
    : String(index + 1);

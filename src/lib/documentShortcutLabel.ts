export const documentShortcutLabel = (index: number) =>
  index < 26
    ? String.fromCharCode("A".charCodeAt(0) + index)
    : String(index + 1);

export const createDocumentShortcutLabeler = (roots: readonly string[]) => {
  const labels = new Map<string, string>();
  for (const root of roots) {
    if (!labels.has(root)) {
      labels.set(root, documentShortcutLabel(labels.size));
    }
  }
  return (root: string) =>
    labels.get(root) ?? documentShortcutLabel(labels.size);
};

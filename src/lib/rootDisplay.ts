export type RootDisplay = {
  readonly parent: string;
  readonly leaf: string;
};

export function formatRootDisplay(root: string): RootDisplay {
  const segments = root.split("/").filter(Boolean);
  if (segments.length === 0) return { parent: "", leaf: root };
  const leaf = segments.at(-1) ?? root;
  if (segments.length <= 1) return { parent: "/", leaf };
  const parent = segments.at(-2) ?? "";
  if (segments.length === 2) return { parent: `/${parent}/`, leaf };
  return { parent: `…/${parent}/`, leaf };
}

export function formatCompactRootPath(root: string): string {
  const segments = root.split("/").filter(Boolean);
  if (segments.length === 0) return root;
  return `…/${segments.slice(-2).join("/")}`;
}

export function joinRootPath(root: string, path: string): string {
  return root.endsWith("/") ? `${root}${path}` : `${root}/${path}`;
}

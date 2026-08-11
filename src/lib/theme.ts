import type { ResolvedTheme, SpacePalette, Theme } from "@/types/library";

export function resolveTheme(
  theme: Theme,
  prefersDark: boolean,
): ResolvedTheme {
  if (theme === "system") return prefersDark ? "dark" : "light";
  return theme;
}

export function applyResolvedTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

export function applySpacePalette(palette: SpacePalette): void {
  document.documentElement.dataset.spacePalette = palette;
}

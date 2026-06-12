import { useParams, useRouterState } from "@tanstack/react-router";
import { BookOpen, Code2, Zap, type LucideIcon } from "lucide-react";
import { stripBase } from "@/lib/base";
import { useReaderData } from "@/lib/useReaderData";

export interface ShelfContext {
  key: "guides" | "advanced" | "developer";
  /** i18n key for the label. */
  labelKey: string;
  /** Shelf route (without locale). */
  to: string;
  icon: LucideIcon;
}

const SHELVES: Record<ShelfContext["key"], ShelfContext> = {
  guides: {
    key: "guides",
    labelKey: "nav.guides",
    to: "/$locale/guides",
    icon: BookOpen,
  },
  advanced: {
    key: "advanced",
    labelKey: "nav.advanced",
    to: "/$locale/advanced",
    icon: Zap,
  },
  developer: {
    key: "developer",
    labelKey: "sections.developer",
    to: "/$locale/dev",
    icon: Code2,
  },
};

/**
 * Which shelf the reader is "under" right now — drives the context-aware
 * slot in the bottom bar: Guides normally, Advanced inside wikis or the
 * Advanced shelf, Developer inside dev content. Resolution: the open
 * book's section first, the route otherwise.
 */
export function useShelfContext(): ShelfContext {
  const reader = useReaderData();
  const params = useParams({ strict: false });
  const pathname = useRouterState({
    select: (s) => stripBase(s.location.pathname),
  });

  if (reader) {
    const section = reader.manifest.collections.find(
      (c) => c.slug === reader.collection,
    )?.section;
    if (section === "wikis") return SHELVES.advanced;
    if (section === "dev") return SHELVES.developer;
    return SHELVES.guides;
  }

  const locale = params.locale ?? "";
  if (pathname.startsWith(`/${locale}/advanced`)) return SHELVES.advanced;
  if (pathname.startsWith(`/${locale}/dev`)) return SHELVES.developer;
  return SHELVES.guides;
}

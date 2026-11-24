import { createContext, useContext } from "react";
import type { PagePosition } from "@/lib/content/neighbors";

/** `?slide=` of a reader URL: a 1-based step, or the deck's last one. */
export type SlideParam = number | "last";

/** What a block needs to know about the reader pane it is rendered in. */
export interface Pane {
  locale: string;
  /** The pane's own page and its neighbours — not the URL's. */
  position: PagePosition;
  /** The pane shows the URL's page; neighbour panes are mounted but inert. */
  isCurrent: boolean;
  /** The URL's `?slide=`, on the current pane only. */
  slide?: SlideParam;
  /**
   * Walk on into the neighbouring page as the next step of a slideset: a
   * step back lands on that page's last slide. `cut` shows it without the
   * page-turn animation.
   */
  step: (dir: 1 | -1, cut: boolean) => void;
}

export const PaneContext = createContext<Pane | undefined>(undefined);

export function usePane(): Pane | undefined {
  return useContext(PaneContext);
}

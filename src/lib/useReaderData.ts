import { useMatches } from "@tanstack/react-router";
import type { ReaderData } from "@/routes/$locale/$";

/**
 * The active reader route's loader data, if any — lets shell chrome
 * (bottom bar, platform selector) adapt to the book being read.
 */
export function useReaderData(): ReaderData | undefined {
  const matches = useMatches();
  const match = matches.find((m) => m.routeId === "/$locale/$");
  return match?.loaderData as ReaderData | undefined;
}

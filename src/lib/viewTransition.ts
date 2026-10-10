/** Overlays opened mid-transition are painted under the sliding page. */
export async function afterViewTransition(): Promise<void> {
  if (typeof document === "undefined") return;
  const active = (document as { activeViewTransition?: ViewTransition | null })
    .activeViewTransition;
  if (active) {
    await active.finished.catch(() => {});
    return;
  }
  if (active === null || typeof document.getAnimations !== "function") return;
  // Fallback: transition animations start a frame or two after the DOM update.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  const running = document
    .getAnimations()
    .filter((a) =>
      (a.effect as KeyframeEffect | null)?.pseudoElement?.startsWith(
        "::view-transition",
      ),
    );
  await Promise.all(running.map((a) => a.finished.catch(() => {})));
}

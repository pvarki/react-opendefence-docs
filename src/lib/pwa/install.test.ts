import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePwaInstall } from "./install";

function firePrompt() {
  let prompted = false;
  const e = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(e, {
    prompt: () => {
      prompted = true;
      return Promise.resolve();
    },
  });
  act(() => {
    window.dispatchEvent(e);
  });
  return { event: e, wasPrompted: () => prompted };
}

describe("usePwaInstall", () => {
  it("captures beforeinstallprompt, installs once, then resets", async () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstall).toBe(false);

    const { event, wasPrompted } = firePrompt();
    expect(event.defaultPrevented).toBe(true);
    expect(result.current.canInstall).toBe(true);

    await act(() => result.current.install());
    expect(wasPrompted()).toBe(true);
    // Prompt events are single-use — the button must disappear after.
    expect(result.current.canInstall).toBe(false);
  });

  it("clears the pending prompt on appinstalled", () => {
    const { result } = renderHook(() => usePwaInstall());
    firePrompt();
    expect(result.current.canInstall).toBe(true);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.canInstall).toBe(false);
  });
});

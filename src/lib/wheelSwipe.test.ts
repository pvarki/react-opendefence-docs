import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { onWheelSwipe } from "./wheelSwipe";

// The events carry the time: streams are told apart by their own clock.
let now = 0;
const wait = (ms: number) => (now += ms);

const wheel = (target: Element, deltaX: number, deltaY = 0) => {
  const event = new WheelEvent("wheel", { deltaX, deltaY, bubbles: true });
  Object.defineProperty(event, "timeStamp", { value: now });
  target.dispatchEvent(event);
};

describe("onWheelSwipe", () => {
  let el: HTMLElement;
  let swipes: number[];
  let off: () => void;

  beforeEach(() => {
    wait(1000); // the previous test's stream is over
    el = document.createElement("div");
    document.body.append(el);
    swipes = [];
    off = onWheelSwipe(el, (dir) => swipes.push(dir));
  });

  afterEach(() => {
    off();
    el.remove();
  });

  it("fires once a short flick has travelled far enough", () => {
    wheel(el, 30);
    expect(swipes).toEqual([]);
    wheel(el, 40);
    expect(swipes).toEqual([1]);
  });

  it("reads the direction from the travel", () => {
    wheel(el, -80);
    expect(swipes).toEqual([-1]);
  });

  it("ignores the rest of the stream, inertia included, until it pauses", () => {
    wheel(el, 80);
    for (let i = 0; i < 30; i++) {
      wait(16);
      wheel(el, 40);
    }
    expect(swipes).toEqual([1]);
    wait(300);
    wheel(el, 80);
    expect(swipes).toEqual([1, 1]);
  });

  it("forgets travel that stopped short", () => {
    wheel(el, 40);
    wait(300);
    wheel(el, 40);
    expect(swipes).toEqual([]);
  });

  it("never adds up sideways drift in a vertical scroll", () => {
    for (let i = 0; i < 20; i++) {
      wheel(el, 30, 10); // one sideways twitch...
      wheel(el, 5, 60); // ...in a scroll that is going down
    }
    expect(swipes).toEqual([]);
  });

  it("leaves a block that scrolls sideways itself alone", () => {
    const code = document.createElement("pre");
    code.style.overflowX = "auto";
    Object.defineProperty(code, "scrollWidth", { value: 900 });
    Object.defineProperty(code, "clientWidth", { value: 300 });
    el.append(code);
    wheel(code, 200);
    expect(swipes).toEqual([]);
  });

  it("keeps a swipe from an enclosing swipe area", () => {
    const outer: number[] = [];
    const offOuter = onWheelSwipe(document.body, (dir) => outer.push(dir));
    wheel(el, 80);
    offOuter();
    expect(swipes).toEqual([1]);
    expect(outer).toEqual([]);
  });

  it("spends a stream for every swipe area it then passes over", () => {
    // The page it turned brings another slideset under the pointer.
    const next = document.createElement("div");
    document.body.append(next);
    const landed: number[] = [];
    const offNext = onWheelSwipe(next, (dir) => landed.push(dir));
    wheel(el, 80);
    wait(16);
    wheel(next, 80);
    offNext();
    next.remove();
    expect(swipes).toEqual([1]);
    expect(landed).toEqual([]);
  });

  it("stops listening once unsubscribed", () => {
    off();
    wheel(el, 200);
    expect(swipes).toEqual([]);
  });
});

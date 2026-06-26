// Branching questionnaire driving the OrientationModal. Pure data + types so the
// integrity test can import it without pulling in React.
//
// ponytail: doc links are hardcoded here. Collection covers (e.g. "working-with-tak")
// are stable; page-level splats carry Outline IDs that can change on `pnpm sync`.
// If they drift, resolve slugs from the manifest like dev/index.tsx does instead.

export type TrackKey = "contribute" | "integrate" | "operate";

// Exposed so the dev shelf gates its auto-open, and the home doors can pre-mark
// it seen (using a door is itself an orientation, so /dev shouldn't re-prompt).
const SEEN_KEY = "od-orient-seen-v1";

export function orientationSeen(): boolean {
  try {
    return !!localStorage.getItem(SEEN_KEY);
  } catch {
    return false;
  }
}

export function markOrientationSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // private mode / storage blocked
  }
}

export type Target = { to: string; splat?: string };

export type Option = {
  /** i18n key for the option label. */
  key: string;
  /** Selector only: picking this option enters that track. */
  track?: TrackKey;
  /** Info answer revealed in place (i18n key). */
  bodyKey?: string;
  /** Doc link: navigates and closes the modal. */
  target?: Target;
  /** Selector only: close the modal immediately ("just show me the docs"). */
  close?: boolean;
};

export type Question = {
  promptKey: string;
  leadKey?: string;
  options: Option[];
};

export const SELECTOR: Question = {
  promptKey: "orient.selector.lead",
  options: [
    { key: "orient.selector.contribute", track: "contribute" },
    { key: "orient.selector.integrate", track: "integrate" },
    { key: "orient.selector.operate", track: "operate" },
    { key: "orient.selector.skip", close: true },
  ],
};

export const FLOWS: Record<TrackKey, Question[]> = {
  contribute: [
    {
      promptKey: "orient.contribute.q1.prompt",
      options: [
        {
          key: "orient.contribute.q1.a1",
          bodyKey: "orient.contribute.q1.a1Body",
        },
        {
          key: "orient.contribute.q1.a2",
          bodyKey: "orient.contribute.q1.a2Body",
        },
        {
          key: "orient.contribute.q1.a3",
          bodyKey: "orient.contribute.q1.a3Body",
        },
      ],
    },
    {
      promptKey: "orient.contribute.q2.prompt",
      leadKey: "orient.contribute.q2.lead",
      options: [
        {
          key: "orient.contribute.q2.a1",
          bodyKey: "orient.contribute.q2.a1Body",
        },
        {
          key: "orient.contribute.q2.a2",
          bodyKey: "orient.contribute.q2.a2Body",
        },
        {
          key: "orient.contribute.q2.a3",
          bodyKey: "orient.contribute.q2.a3Body",
        },
        {
          key: "orient.contribute.q2.a4",
          bodyKey: "orient.contribute.q2.a4Body",
        },
      ],
    },
    {
      promptKey: "orient.contribute.q3.prompt",
      leadKey: "orient.contribute.q3.lead",
      options: [
        { key: "orient.contribute.q3.a1", target: { to: "/$locale/dev" } },
        {
          key: "orient.contribute.q3.a2",
          target: {
            to: "/$locale/$",
            splat:
              "develop-deploy-app/set-up-your-dev-environment-docker-compose-t4JDwRuQs2",
          },
        },
        {
          key: "orient.contribute.q3.a3",
          target: {
            to: "/$locale/$",
            splat: "introduction/architecture-orientation-H9Vndl9nba",
          },
        },
        {
          key: "orient.contribute.q3.a4",
          target: {
            to: "/$locale/$",
            splat: "develop-deploy-app/best-practices-ci-library-axlX8ORNt2",
          },
        },
        {
          key: "orient.contribute.q3.a5",
          target: {
            to: "/$locale/$",
            splat: "contribute-to-project/contributing-dsXGjtdXG8",
          },
        },
        {
          key: "orient.contribute.q3.a6",
          target: { to: "/$locale/$", splat: "working-with-tak" },
        },
      ],
    },
  ],
  integrate: [
    {
      promptKey: "orient.integrate.q1.prompt",
      options: [
        {
          key: "orient.integrate.q1.a1",
          bodyKey: "orient.integrate.q1.a1Body",
        },
        {
          key: "orient.integrate.q1.a2",
          bodyKey: "orient.integrate.q1.a2Body",
        },
        {
          key: "orient.integrate.q1.a3",
          bodyKey: "orient.integrate.q1.a3Body",
        },
      ],
    },
    {
      promptKey: "orient.integrate.q2.prompt",
      leadKey: "orient.integrate.q2.lead",
      options: [
        {
          key: "orient.integrate.q2.a1",
          target: {
            to: "/$locale/$",
            splat: "build-an-integration/integration-overview-unDmuW0qFc",
          },
        },
        {
          key: "orient.integrate.q2.a2",
          target: {
            to: "/$locale/$",
            splat: "build-an-integration/scaffold-from-the-template-EhvdImAQbC",
          },
        },
        {
          key: "orient.integrate.q2.a3",
          target: {
            to: "/$locale/$",
            splat: "build-an-integration/worked-example-matrix-918lI88Lsy",
          },
        },
        {
          key: "orient.integrate.q2.a4",
          target: {
            to: "/$locale/$",
            splat:
              "build-an-integration/integration-conventions-donts-cwt08BEcut",
          },
        },
      ],
    },
  ],
  operate: [
    {
      promptKey: "orient.operate.q1.prompt",
      options: [
        { key: "orient.operate.q1.a1", bodyKey: "orient.operate.q1.a1Body" },
        { key: "orient.operate.q1.a2", bodyKey: "orient.operate.q1.a2Body" },
        { key: "orient.operate.q1.a3", bodyKey: "orient.operate.q1.a3Body" },
      ],
    },
    {
      promptKey: "orient.operate.q2.prompt",
      leadKey: "orient.operate.q2.lead",
      options: [
        {
          key: "orient.operate.q2.a1",
          target: {
            to: "/$locale/$",
            splat: "operate/operator-quickstart-iQzhtjCDTg",
          },
        },
        {
          key: "orient.operate.q2.a2",
          target: {
            to: "/$locale/$",
            splat: "operate/deploy-with-docker-compose-B518eLioFe",
          },
        },
        {
          key: "orient.operate.q2.a3",
          target: {
            to: "/$locale/$",
            splat: "operate/deploy-on-kubernetes-S5cwJYQzPu",
          },
        },
        {
          key: "orient.operate.q2.a4",
          target: {
            to: "/$locale/$",
            splat: "operate/audit-logging-observability-Va3sP3XTgz",
          },
        },
      ],
    },
  ],
};

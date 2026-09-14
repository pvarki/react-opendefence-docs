import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy all-components releases page — releases are now per book. */
export const Route = createFileRoute("/$locale/dev/releases")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$locale/dev", params: { locale: params.locale } });
  },
});

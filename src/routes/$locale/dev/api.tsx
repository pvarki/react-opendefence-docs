import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy single API page — the core spec now lives on its own book. */
export const Route = createFileRoute("/$locale/dev/api")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/$locale/dev/$book/$view",
      params: {
        locale: params.locale,
        book: "develop-deploy-app",
        view: "api",
      },
    });
  },
});

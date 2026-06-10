import { createFileRoute, redirect } from "@tanstack/react-router";
import { getStoredLocale } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/$locale", params: { locale: getStoredLocale() } });
  },
});

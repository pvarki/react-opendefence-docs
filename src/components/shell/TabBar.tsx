import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BookOpen, Code2, House, Search, Smartphone } from "lucide-react";
import { DEFAULT_LOCALE } from "@shared/content-schema";

const TABS = [
  {
    to: "/$locale",
    splat: undefined,
    icon: House,
    key: "nav.home",
    exact: true,
  },
  {
    to: "/$locale/$",
    splat: "deploy-app",
    icon: Smartphone,
    key: "nav.deployApp",
  },
  {
    to: "/$locale/guides",
    splat: undefined,
    icon: BookOpen,
    key: "nav.guides",
  },
  { to: "/$locale/dev", splat: undefined, icon: Code2, key: "nav.develop" },
  { to: "/$locale/search", splat: undefined, icon: Search, key: "nav.search" },
] as const;

export function TabBar() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;

  return (
    <nav
      aria-label={t("nav.home")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid h-14 grid-cols-5">
        {TABS.map(({ to, splat, icon: Icon, key, ...rest }) => (
          <Link
            key={key}
            to={to}
            params={splat ? { locale, _splat: splat } : { locale }}
            activeOptions={{ exact: "exact" in rest && rest.exact }}
            className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors [&.active]:text-primary"
            activeProps={{ "aria-current": "page" }}
          >
            <Icon className="size-5" />
            <span className="text-[10px] leading-none">{t(key)}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

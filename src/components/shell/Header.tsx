import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE } from "@shared/content-schema";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { CommandMenu } from "@/components/search/CommandMenu";

const NAV_ITEMS = [
  { splat: "deploy-app", key: "nav.deployApp" },
  { splat: "guides", key: "nav.guides" },
  { splat: "dev", key: "nav.develop" },
] as const;

export function Header() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;

  return (
    <header className="sticky top-0 z-50 flex h-[var(--header-h)] shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-6">
        <Link
          to="/$locale"
          params={{ locale }}
          className="flex shrink-0 items-center gap-2 font-bold"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary font-mono text-sm text-primary-foreground">
            OD
          </span>
          <span className="hidden sm:inline">{t("app.title")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.splat}
              to={`/$locale/${item.splat}` as string}
              params={{ locale }}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:text-primary"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <CommandMenu />
        <LocaleSwitcher />
      </div>
    </header>
  );
}

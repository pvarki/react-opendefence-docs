import {
  Link,
  useCanGoBack,
  useParams,
  useRouter,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { DEFAULT_LOCALE } from "@shared/content-schema";
import { LocaleSwitcher } from "@/components/shell/LocaleSwitcher";
import { PlatformSelector } from "@/components/shell/PlatformSelector";
import { CommandMenu } from "@/components/search/CommandMenu";

const NAV_ITEMS = [
  { splat: "deploy-app", key: "nav.deployApp" },
  { splat: "guides", key: "nav.guides" },
  { splat: "advanced", key: "nav.advanced" },
  { splat: "dev", key: "nav.develop" },
] as const;

export function Header() {
  const { t } = useTranslation();
  const params = useParams({ strict: false });
  const locale = params.locale ?? DEFAULT_LOCALE;
  const router = useRouter();
  const canGoBack = useCanGoBack();

  return (
    <header className="sticky top-0 z-50 flex h-[var(--header-h)] shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        {/* History back for installed-PWA use where there is no browser
            chrome; desktop browsers have their own. */}
        {canGoBack && (
          <button
            type="button"
            onClick={() => router.history.back()}
            aria-label={t("nav.back")}
            className="-ml-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <ChevronLeft className="size-5" />
          </button>
        )}
        <Link
          to="/$locale"
          params={{ locale }}
          className="flex shrink-0 items-center gap-2 font-bold"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs text-primary-foreground">
            OD
          </span>
          <span className="hidden text-sm lg:inline">{t("app.title")}</span>
        </Link>

        <nav className="hidden items-center md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.splat}
              to={`/$locale/${item.splat}` as string}
              params={{ locale }}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:text-primary"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <CommandMenu />
        <PlatformSelector />
        <LocaleSwitcher />
      </div>
    </header>
  );
}

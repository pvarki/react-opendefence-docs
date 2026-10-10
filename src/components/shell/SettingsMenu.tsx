import { useTranslation } from "react-i18next";
import { Popover } from "radix-ui";
import { Check, Settings2 } from "lucide-react";
import { LOCALES } from "@shared/content-schema";
import { TextSizeControl } from "@/components/shell/TextSizeControl";
import {
  LOCALE_LABELS,
  useLocaleSwitch,
} from "@/components/shell/LocaleSwitcher";
import { SectionLabel } from "@/components/ui/section-label";
import { cn } from "@/lib/utils";

export function SettingsMenu() {
  const { t } = useTranslation();
  const { current, switchTo } = useLocaleSwitch();

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t("nav.settings")}
        className="-mr-1 flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground md:mr-0 md:size-8"
      >
        <Settings2 className="size-[1.125rem]" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-60 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
        >
          <SectionLabel as="p" className="pb-1.5">
            {t("textSize.label")}
          </SectionLabel>
          <TextSizeControl />

          <SectionLabel as="p" className="pt-4 pb-1.5">
            {t("common.language")}
          </SectionLabel>
          <ul role="radiogroup" aria-label={t("common.language")}>
            {LOCALES.map((locale) => (
              <li key={locale}>
                <Popover.Close asChild>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={locale === current}
                    onClick={() => switchTo(locale)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                      locale === current
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {LOCALE_LABELS[locale]}
                    {locale === current && <Check className="size-4" />}
                  </button>
                </Popover.Close>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

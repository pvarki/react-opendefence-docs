import { useTranslation } from "react-i18next";
import { MonitorSmartphone } from "lucide-react";
import { PLATFORMS, type PlatformInfo } from "@shared/content-schema";
import { PLATFORM_LABELS, setPlatform, usePlatform } from "@/lib/platform";
import { useReaderData } from "@/lib/useReaderData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

/**
 * Navbar platform switcher. Auto-picked from the user agent on first visit,
 * always remembered. Inside a book the options use the book's own labels
 * (e.g. ATAK/iTAK/WinTAK in the TAK guide) and carry an "under development"
 * tag when the platform's organizer doc in Outline says so.
 */
export function PlatformSelector() {
  const { t } = useTranslation();
  const active = usePlatform();
  const reader = useReaderData();

  const bookPlatforms = reader?.manifest.collections.find(
    (c) => c.slug === reader.collection,
  )?.platforms;

  const options: PlatformInfo[] =
    bookPlatforms && bookPlatforms.length > 0
      ? bookPlatforms
      : PLATFORMS.map((key) => ({ key, label: PLATFORM_LABELS[key] }));

  const activeOption = options.find((o) => o.key === active);

  return (
    <Select value={active} onValueChange={(v) => setPlatform(v as never)}>
      <SelectTrigger
        size="sm"
        className="gap-1.5 border-input bg-transparent"
        aria-label={t("platform.label")}
      >
        <MonitorSmartphone className="size-4" />
        <span className="hidden sm:inline">
          {activeOption?.label ?? PLATFORM_LABELS[active]}
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.key} value={option.key}>
            <span className="flex items-center gap-2">
              {option.label}
              {option.underDevelopment && (
                <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                  {t("platform.underDevelopment")}
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

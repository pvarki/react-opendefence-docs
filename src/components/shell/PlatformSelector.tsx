import { useTranslation } from "react-i18next";
import { PLATFORM_LABELS, useReadingView } from "@/lib/platform";
import { usePlatformPicker } from "@/lib/usePlatformPicker";
import { useReaderData } from "@/lib/useReaderData";
import { PlatformIcon, IncompleteBadge } from "@/components/shell/PlatformIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

/**
 * Navbar platform/client switcher. Auto-picked from the user agent on first
 * visit, always remembered. Inside a book the options are the book's own
 * clients (e.g. ATAK / iTAK / WinTAK / TAK Tracker in the TAK guide) and
 * carry a red "Incomplete" tag when the client's organizer doc in Outline
 * says so.
 */
export function PlatformSelector() {
  const { t } = useTranslation();
  const view = useReadingView();
  const reader = useReaderData();
  const { options, active, pick } = usePlatformPicker(reader);

  return (
    <Select
      value={active?.id ?? view.platform}
      onValueChange={(id) => {
        const next = options.find((o) => o.id === id);
        if (next) pick(next);
      }}
    >
      <SelectTrigger
        size="sm"
        className="gap-1.5 border-input bg-transparent"
        aria-label={t("platform.label")}
      >
        <PlatformIcon
          platform={active?.platform ?? view.platform}
          className="size-4"
        />
        <span className="max-w-24 truncate sm:max-w-none">
          {active?.label ?? PLATFORM_LABELS[view.platform]}
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span className="flex items-center gap-2">
              <PlatformIcon
                platform={option.platform}
                className="size-4 text-muted-foreground"
              />
              {option.label}
              {option.underDevelopment && <IncompleteBadge />}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

import { useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { MonitorSmartphone } from "lucide-react";
import { PLATFORMS, type ClientInfo } from "@shared/content-schema";
import {
  PLATFORM_LABELS,
  setClientForBook,
  setPlatform,
  useReadingView,
} from "@/lib/platform";
import { readingOrder, resolveClient } from "@/lib/content/neighbors";
import { useReaderData } from "@/lib/useReaderData";
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
 * carry an "under development" tag when the client's organizer doc in
 * Outline says so.
 */
export function PlatformSelector() {
  const { t } = useTranslation();
  const view = useReadingView();
  const reader = useReaderData();
  const navigate = useNavigate();
  const params = useParams({ strict: false });

  const bookClients = reader?.manifest.collections.find(
    (c) => c.slug === reader.collection,
  )?.clients;

  const options: ClientInfo[] =
    bookClients && bookClients.length > 0
      ? bookClients
      : PLATFORMS.map((key) => ({
          id: key,
          platform: key,
          label: PLATFORM_LABELS[key],
        }));

  const active =
    reader && bookClients?.length
      ? resolveClient(reader.manifest, reader.collection, view)
      : options.find((o) => o.platform === view.platform);

  // Picking a client while reading a page that doesn't exist in that view
  // lands on the view's first page of the current book.
  const pick = (id: string) => {
    const next = options.find((o) => o.id === id);
    if (!next) return;
    if (reader && bookClients?.length) {
      setClientForBook(reader.collection, next.id);
    }
    setPlatform(next.platform);
    if (!reader?.slug) return;
    const current = reader.manifest.pages.find(
      (p) => p.collection === reader.collection && p.slug === reader.slug,
    );
    if (!current || (!current.clientId && !current.platform)) return;
    const stillVisible = current.clientId
      ? current.clientId === next.id
      : current.platform === next.platform;
    if (stillVisible) return;
    const nextView = {
      platform: next.platform,
      clientOverrides: {
        ...view.clientOverrides,
        [reader.collection]: next.id,
      },
    };
    const first = readingOrder(reader.manifest, reader.collection, nextView)[0];
    void navigate({
      to: "/$locale/$",
      params: {
        locale: params.locale ?? "en",
        _splat: first ? `${first.collection}/${first.slug}` : reader.collection,
      },
    });
  };

  return (
    <Select value={active?.id ?? view.platform} onValueChange={pick}>
      <SelectTrigger
        size="sm"
        className="gap-1.5 border-input bg-transparent"
        aria-label={t("platform.label")}
      >
        <MonitorSmartphone className="size-4" />
        <span className="max-w-24 truncate sm:max-w-none">
          {active?.label ?? PLATFORM_LABELS[view.platform]}
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
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

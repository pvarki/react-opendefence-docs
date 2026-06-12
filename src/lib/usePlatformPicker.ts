import { useNavigate, useParams } from "@tanstack/react-router";
import { PLATFORMS, type ClientInfo } from "@shared/content-schema";
import {
  PLATFORM_LABELS,
  setClientForBook,
  setPlatform,
  useReadingView,
} from "@/lib/platform";
import { readingOrder, resolveClient } from "@/lib/content/neighbors";
import type { ReaderData } from "@/routes/$locale/$";

/**
 * One source for platform/client switching, shared by the navbar selector,
 * the platform sheet, the book contents sheet and the book cover. Inside a
 * book with clients the options are the book's clients; elsewhere the
 * generic platform list. Picking while reading a page that doesn't exist in
 * the chosen view relocates to that view's first page of the current book.
 */
export function usePlatformPicker(reader?: ReaderData) {
  const view = useReadingView();
  const navigate = useNavigate();
  const params = useParams({ strict: false });

  const bookClients = reader?.manifest.collections.find(
    (c) => c.slug === reader.collection,
  )?.clients;
  const hasClients = !!bookClients?.length;

  // Inside a platform-agnostic book (no Platforms organizer in Outline) the
  // selector has no meaning — return empty options so callers hide it.
  // Outside a book (home, shelf pages) fall back to the generic OS list so
  // users can set their platform preference before opening any book.
  const options: ClientInfo[] =
    reader && !hasClients
      ? []
      : hasClients
        ? bookClients!
        : PLATFORMS.map((key) => ({
            id: key,
            platform: key,
            label: PLATFORM_LABELS[key],
          }));

  const active =
    reader && hasClients
      ? resolveClient(reader.manifest, reader.collection, view)
      : options.find((o) => o.platform === view.platform);

  const pick = (next: ClientInfo) => {
    if (reader && hasClients) {
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

  return { options, active, pick, hasClients };
}

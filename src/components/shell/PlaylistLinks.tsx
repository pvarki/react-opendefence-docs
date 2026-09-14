import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MonitorPlay } from "lucide-react";
import { loadVideos, type VideoPlaylist } from "@/lib/videos";

/**
 * Links out to the guide videos on YouTube, one playlist per product and
 * platform — the unit a reader actually holds, since someone on iOS has no use
 * for the Android steps.
 *
 * Renders nothing until there is at least one playlist, so the shelf is
 * unchanged on a build whose manifest is empty or unreachable.
 */
export function PlaylistLinks() {
  const { t } = useTranslation();
  const [playlists, setPlaylists] = useState<VideoPlaylist[]>([]);

  useEffect(() => {
    let cancelled = false;
    void loadVideos().then((m) => {
      if (!cancelled) setPlaylists(m.playlists);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (playlists.length === 0) return null;

  return (
    <>
      {/* Matches the shelf's own section headings, which are route-local. */}
      <h2 className="px-1 pt-5 pb-2 text-[11px] font-semibold tracking-widest text-primary uppercase">
        {t("videoPlaylists.heading")}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {playlists.map((p) => (
          <a
            key={p.url}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
          >
            <MonitorPlay className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {p.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {p.videos}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}

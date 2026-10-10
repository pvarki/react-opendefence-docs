import { useTranslation } from "react-i18next";

/**
 * youtube-nocookie embed. Used by the "youtube" content block and by the
 * per-page video that stands in for a slideset.
 */
export function YoutubeBlock({
  videoId,
  title,
}: {
  videoId: string;
  title?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="my-6 aspect-video">
      <iframe
        className="h-full w-full rounded-lg border border-border"
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title={title ?? t("blocks.youtubeTitle")}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}

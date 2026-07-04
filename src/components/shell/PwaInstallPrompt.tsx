import { useTranslation } from "react-i18next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa/install";

/**
 * "Install this site as an app" box: native prompt button on Chromium,
 * Add-to-Home-Screen instructions on iOS Safari, nothing when already
 * installed or unsupported. Shown on the intro modal's last slide and in
 * the homepage footer.
 */
export function PwaInstallPrompt() {
  const { t } = useTranslation();
  const { canInstall, showIosHint, install } = usePwaInstall();

  if (!canInstall && !showIosHint) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t("pwa.lead")}
      </p>
      {canInstall ? (
        <Button size="sm" className="mt-2" onClick={() => void install()}>
          <Download />
          {t("pwa.install")}
        </Button>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground/80">
          {t("pwa.iosHint")}
        </p>
      )}
    </div>
  );
}

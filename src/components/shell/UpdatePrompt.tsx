import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Service-worker update flow: prompt instead of auto-reload so a page is
 * never yanked out from under a reader mid-task. Long-lived installed apps
 * also re-check hourly and on tab focus.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => void registration.update();
      const interval = setInterval(check, 60 * 60 * 1000);
      const onVisible = () => {
        if (document.visibilityState === "visible") check();
      };
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", onVisible);
      };
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast(t("common.updateAvailable"), {
      duration: Infinity,
      action: {
        label: t("common.reload"),
        onClick: () => void updateServiceWorker(true),
      },
    });
  }, [needRefresh, t, updateServiceWorker]);

  return null;
}

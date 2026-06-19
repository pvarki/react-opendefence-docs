import { Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import { withBase } from "@/lib/base";

/**
 * Subtle "this site is agent-friendly" note for the foot of the main shelves.
 * Invites the reader to point an AI agent at the site, and links agents to the
 * machine-readable entry point (/llms.txt). `example` is a ready-to-use question
 * tailored to the page the note sits on.
 */
export function AgentFriendlyNote({ example }: { example: string }) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 flex items-start gap-2.5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground/80">
      <Bot
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70"
        aria-hidden
      />
      <p>
        <span className="font-semibold text-muted-foreground">
          {t("agentNote.label")}
        </span>{" "}
        {t("agentNote.lead")} <span className="italic">“{example}”</span>{" "}
        <a
          href={withBase("/llms.txt")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {t("agentNote.link")}
        </a>
      </p>
    </div>
  );
}

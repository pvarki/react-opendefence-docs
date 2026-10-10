import { GuideIssuesLink } from "@/components/shell/GuideIssuesLink";
import { SuggestEditLink } from "@/components/shell/SuggestEditLink";

interface PageFooterProps {
  collection: string;
  /** This page's title + Outline doc id, for the "Suggest an edit" link. */
  title?: string;
  docId?: string;
}

export function PageFooter({ collection, title, docId }: PageFooterProps) {
  return (
    <footer className="mt-8 flex flex-wrap justify-end gap-x-4 gap-y-1 [&_a]:inline-block [&_a]:py-1.5">
      {title && (
        <SuggestEditLink collection={collection} title={title} docId={docId} />
      )}
      <GuideIssuesLink collection={collection} />
    </footer>
  );
}

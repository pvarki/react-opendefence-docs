import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

/** Shown on a book's last page: where the reader goes next. */
export function EndOfBookCard({
  nextBook,
}: {
  nextBook: { label: string; href: string };
}) {
  return (
    <Link
      to={nextBook.href}
      className="mt-8 flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary"
    >
      <span className="font-semibold">{nextBook.label}</span>
      <ArrowRight className="size-4 text-primary" />
    </Link>
  );
}

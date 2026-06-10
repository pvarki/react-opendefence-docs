import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { searchDocs, type SearchHit } from "@/lib/search/pagefind-client";

/** Desktop search: header button + ⌘K command palette over pagefind. */
export function CommandMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const onQuery = useCallback((query: string) => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setSearching(true);
      void searchDocs(query)
        .then(setHits)
        .finally(() => setSearching(false));
    }, 150);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="hidden gap-2 text-muted-foreground md:flex"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        {t("search.placeholder")}
        <Kbd>⌘K</Kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">{t("nav.search")}</DialogTitle>
          <DialogDescription className="sr-only" />
          {/* Filtering is pagefind's job — cmdk must not re-filter results. */}
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={t("search.placeholder")}
              onValueChange={onQuery}
            />
            <CommandList>
              <CommandEmpty>
                {searching ? t("search.searching") : t("search.noResults")}
              </CommandEmpty>
              {hits.map((hit) => (
                <CommandItem
                  key={hit.url}
                  value={hit.url}
                  onSelect={() => {
                    setOpen(false);
                    void navigate({ to: hit.url });
                  }}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{hit.title}</p>
                    <p
                      className="truncate text-xs text-muted-foreground [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-primary"
                      dangerouslySetInnerHTML={{ __html: hit.excerpt }}
                    />
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

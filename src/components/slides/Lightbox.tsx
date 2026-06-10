import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

interface LightboxProps {
  src?: string;
  alt?: string;
  onClose: () => void;
}

/** Fullscreen image enlarger shared by the slide deck and the step list. */
export function Lightbox({ src, alt, onClose }: LightboxProps) {
  return (
    <Dialog open={!!src} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-swipe-scope="lightbox"
        showCloseButton
        className="flex h-[95dvh] w-[95vw] max-w-none items-center justify-center border-none bg-black/95 p-0 shadow-none sm:max-w-none"
        onClick={onClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{alt ?? ""}</DialogTitle>
        <DialogDescription className="sr-only" />
        {src && (
          <img
            src={src}
            alt={alt ?? ""}
            className="max-h-[90dvh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Braces } from "lucide-react";

export const Route = createFileRoute("/$locale/dev/api")({
  component: ApiReferencePage,
});

// The embedded Scalar explorer lands in M7; this route is its stable URL.
function ApiReferencePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-bold">API Reference</h1>
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-6 text-muted-foreground">
          <Braces className="size-5 text-primary" />
          The interactive API reference is coming soon.
        </div>
      </div>
    </div>
  );
}

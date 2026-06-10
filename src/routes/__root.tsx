import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/shell/Header";
import { TabBar } from "@/components/shell/TabBar";
import { NotFound } from "@/components/shell/NotFound";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Header />
      <main className="min-h-0 flex-1 pb-[var(--tabbar-h)]">
        <Outlet />
      </main>
      <TabBar />
      <Toaster />
    </div>
  );
}

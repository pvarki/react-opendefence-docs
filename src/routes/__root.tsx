import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/shell/Header";
import { TabBar } from "@/components/shell/TabBar";
import { IntroModal } from "@/components/shell/IntroModal";
import { NotFound } from "@/components/shell/NotFound";
import { UpdatePrompt } from "@/components/shell/UpdatePrompt";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Header />
      <main className="shelf-vt-main min-h-0 flex-1 pb-[var(--tabbar-h)]">
        <Outlet />
      </main>
      <TabBar />
      <IntroModal />
      <Toaster />
      <UpdatePrompt />
    </div>
  );
}

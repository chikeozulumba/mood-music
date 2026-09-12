import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { Toaster } from "sonner";
import { AuthStatus } from "@/components/auth-status";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <NuqsAdapter>
      <div className="min-h-screen bg-cream-50 text-ink-900 font-sans antialiased">
        <header className="flex items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="font-serif text-lg text-ink-900">
            Mood Music
          </Link>
          <AuthStatus />
        </header>
        <Outlet />
      </div>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "font-sans rounded-2xl shadow-card",
            title: "text-sm",
          },
        }}
      />
    </NuqsAdapter>
  );
}

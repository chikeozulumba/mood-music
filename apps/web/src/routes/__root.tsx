import { AuthStatus } from "@/components/auth-status";
import { AuthProvider } from "@/lib/auth-context";
import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <NuqsAdapter>
      <AuthProvider>
        <div className="safe-bottom min-h-screen bg-cream-50 text-ink-900 font-sans antialiased">
          <header className="safe-top flex items-center justify-between px-4 pb-4 sm:px-6">
            <Link to="/" className="font-serif text-lg text-ink-900">
              Mood Music
            </Link>
            <AuthStatus />
          </header>
          <Outlet />
        </div>
      </AuthProvider>
      <Toaster
        position="top-center"
        icons={{
          success: null,
          error: null,
          warning: null,
          info: null,
        }}
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

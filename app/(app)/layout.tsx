import { auth } from "@/lib/auth";
import { AppShell } from "@/components/layout/AppShell";
import { CommandPalette } from "@/components/search/CommandPalette";

/**
 * Route group for all authenticated app screens (dashboard, customers,
 * bills, etc.) — wraps them in Stage 1's AppShell (Sidebar/BottomTabBar).
 * `/login` intentionally lives outside this group so it renders without
 * the app chrome (see app/login/page.tsx).
 *
 * Stage 8: also mounts the global Cmd/Ctrl-K `CommandPalette` here (once,
 * outside AppShell's own children) so it's reachable from every
 * authenticated screen without threading state through AppShell/Sidebar.
 */
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <AppShell role={session?.user.role}>
      <CommandPalette hidePhone={session?.user.role === "STAFF"} />
      {children}
    </AppShell>
  );
}

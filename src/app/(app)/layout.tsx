export const dynamic = "force-dynamic";

import Header from "@/components/layout/Header";
import AuthGuard from "@/components/layout/AuthGuard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen botanical-pattern">
      <Header />
      <AuthGuard>{children}</AuthGuard>
    </div>
  );
}

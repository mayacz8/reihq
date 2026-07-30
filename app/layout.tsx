import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "REI HQ",
  description: "Manage your real estate portfolio end to end.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let roleLabel: string | undefined;
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();
      roleLabel = profile ? `${profile.full_name ?? user.email} (${profile.role})` : user.email ?? undefined;
    }
  } catch {
    roleLabel = undefined;
  }

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar roleLabel={roleLabel} />
          <main className="flex-1 overflow-y-auto p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * Every /vendor page needs a VENDOR session. The chrome differs by group:
 *   (portal)/     approved vendors: sidebar shell
 *   onboarding/   applicants: focused setup layout, no portal navigation
 * middleware.ts decides which of the two a vendor may reach.
 */
export default async function VendorRootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.role !== "VENDOR") redirect("/");
  return <>{children}</>;
}

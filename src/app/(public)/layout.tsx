import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { WhatsAppButton } from "@/components/ui/whatsapp-button";
import { AndroidAppButton } from "@/components/ui/android-app-button";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="pt-[80px] md:pt-[108px]">{children}</main>
      <Footer />
      <AndroidAppButton />
      <WhatsAppButton />
    </>
  );
}

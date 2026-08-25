import Image from "next/image";
import Link from "next/link";
import { BlueprintGrid } from "@/components/ui/technical";

interface AuthPageLayoutProps {
  children: React.ReactNode;
}

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center p-4 relative overflow-hidden">
      <BlueprintGrid fade="radial" className="opacity-60" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group">
            <div className="w-20 h-20 border border-[var(--line)] flex items-center justify-center p-3 group-hover:border-[var(--red)]/40 transition-colors">
              <Image
                src="/motoxplus/logo.png"
                alt="MOTOXPLUS India Private Limited"
                width={96}
                height={96}
                className="object-contain"
                priority
              />
            </div>
            <div className="text-center">
              <div className="font-display text-[var(--ink)] font-bold text-xl tracking-tight leading-none">
                MOTOX<span className="text-[var(--red)]">PLUS</span>
              </div>
              <div className="text-[10px] text-[var(--muted)] tracking-widest mt-1.5">
                INDIA PRIVATE LIMITED
              </div>
            </div>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

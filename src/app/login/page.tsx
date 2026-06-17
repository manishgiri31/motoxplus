import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to MotoXPlus India dealer or admin portal.",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-red-950/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-950/10 rounded-full blur-[80px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(var(--border-color) 1px, transparent 1px), linear-gradient(90deg, var(--border-color) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-red-600 via-red-900/30 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <a href="/" className="inline-flex flex-col items-center gap-4 group">
            <Image
              src="/motoxplus/logo.png"
              alt="MOTOXPLUS India Private Limited"
              width={88}
              height={88}
              className="object-contain group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_24px_rgba(220,38,38,0.3)]"
              priority
            />
            <div className="text-center">
              <div className="text-[var(--text-primary)] font-black text-2xl tracking-wide leading-none">
                MOTOX<span className="text-red-500">PLUS</span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] tracking-widest mt-1">
                INDIA PRIVATE LIMITED
              </div>
              <div className="text-[11px] text-red-500 tracking-widest mt-2 font-medium">
                Engineered For Reliability
              </div>
            </div>
          </a>
        </div>

        <Suspense
          fallback={
            <div className="glass border border-[var(--border-color)] rounded-sm p-8 animate-pulse h-64" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

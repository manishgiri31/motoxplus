import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-950/18 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-red-950/10 rounded-full blur-[90px]" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-950/8 rounded-full blur-[70px]" />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(var(--border-color) 1px, transparent 1px), linear-gradient(90deg, var(--border-color) 1px, transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        <div className="absolute top-0 left-0 w-[2px] h-full bg-gradient-to-b from-red-600 via-red-800/30 to-transparent" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-3 group">
            <div className="w-20 h-20 rounded-2xl glass border border-[var(--border-color)] flex items-center justify-center group-hover:border-red-600/40 transition-colors">
              <Image
                src="/motoxplus/logo.png"
                alt="MOTOXPLUS India Private Limited"
                width={64}
                height={64}
                className="object-contain group-hover:scale-105 transition-transform duration-300"
                priority
              />
            </div>
            <div className="text-center">
              <div className="text-[var(--text-primary)] font-black text-2xl tracking-wide leading-none">
                MOTOX<span className="text-red-500">PLUS</span>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] tracking-widest mt-1">
                INDIA PRIVATE LIMITED
              </div>
              <div className="text-[11px] text-red-500 tracking-wider mt-2 font-semibold">
                Engineered For Reliability
              </div>
            </div>
          </Link>
        </div>

        <Suspense
          fallback={
            <div className="glass border border-[var(--border-color)] rounded-2xl p-8 animate-pulse h-64" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

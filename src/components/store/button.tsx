import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "dark";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center rounded-store-pill font-normal transition duration-base ease-apple active:scale-[.98] disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-store-accent";
const sizes: Record<Size, string> = { sm: "text-14 px-4 py-2", md: "text-17 px-[22px] py-3" };
const variants: Record<Variant, string> = {
  primary: "bg-store-accent text-white hover:bg-store-accent-hover active:bg-store-accent-active",
  secondary: "text-store-link ring-1 ring-store-link hover:bg-store-link hover:text-white",
  dark: "bg-store-ink text-white hover:bg-[#333336]",
};

type Props = { variant?: Variant; size?: Size; href?: string; className?: string; children: React.ReactNode } &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function StoreButton({ variant = "primary", size = "md", href, className, children, ...rest }: Props) {
  const cls = cn(base, sizes[size], variants[variant], className);
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

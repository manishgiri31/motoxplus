import { cn } from "@/lib/utils";

/** Spec §5.2: width min(100% - 48px, 1260px); 32px gutters at phone widths. */
export function Container({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-[calc(100%-32px)] bp-md:w-[min(100%-48px,1260px)]", className)} {...rest} />;
}

/** Shared class strings for the seller-acquisition page, so CTAs read as one system. */

// `!` because Button's base `rounded-pill` is a custom radius key that tailwind-merge can't see as a conflict.
export const ctaClass = "!rounded-[4px] font-grotesk text-[14px] font-semibold uppercase tracking-[0.08em]";

export const ctaOutlineDark = `${ctaClass} border-mx-black text-mx-black hover:bg-mx-black hover:text-white`;

export const ctaOutlineLight = `${ctaClass} border-white/40 bg-transparent text-white hover:border-white hover:bg-white hover:text-mx-black`;

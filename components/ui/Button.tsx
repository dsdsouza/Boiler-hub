import Link from "next/link";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg cursor-pointer no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  // Brass plate with a pressed lip (Main.dc.html "Try the demo").
  primary:
    "bg-brass text-soot hover:bg-brass-light hover:text-soot font-display tracking-[0.05em] shadow-[inset_0_-3px_0_var(--color-brass-dark)]",
  secondary: "bg-surface-2 text-fg hover:text-fg border border-rivet font-semibold hover:border-brass",
  ghost: "bg-transparent text-body hover:text-fg border border-line font-medium hover:border-rivet",
};

const sizes: Record<Variant, Record<Size, string>> = {
  primary: { md: "min-h-11 px-[22px] text-[22px]", lg: "min-h-14 px-8 text-[26px]" },
  secondary: { md: "min-h-11 px-[18px] text-sm", lg: "min-h-14 px-[26px] text-base" },
  ghost: { md: "min-h-11 px-[14px] text-sm", lg: "min-h-14 px-[26px] text-base" },
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[variant][size]} ${extra}`;
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant, size, className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

type LinkButtonProps = ComponentProps<"a"> & {
  variant?: Variant;
  size?: Size;
  href: string;
  /** Use a plain anchor (route handlers such as /auth/signin must not be prefetched). */
  plain?: boolean;
};

export function LinkButton({ variant, size, className = "", href, plain, ...rest }: LinkButtonProps) {
  const cls = buttonClass(variant, size, className);
  if (plain) return <a href={href} className={cls} {...rest} />;
  return <Link href={href} className={cls} {...rest} />;
}

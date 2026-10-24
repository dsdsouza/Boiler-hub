import type { ComponentProps, ElementType } from "react";

type CardProps<T extends ElementType> = {
  as?: T;
  /** Riveted plate corners. */
  plate?: boolean;
  /** Brass-rimmed border for the panel that matters most on the screen. */
  emphasis?: boolean;
} & Omit<ComponentProps<T>, "as">;

export function Card<T extends ElementType = "div">({
  as,
  plate,
  emphasis,
  className = "",
  ...rest
}: CardProps<T>) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      className={`rounded-[14px] border bg-surface shadow-(--shadow) ${emphasis ? "border-rivet" : "border-line"} ${plate ? "plate" : ""} ${className}`}
      {...rest}
    />
  );
}

/** Section heading used inside cards (Bebas, 30px in the designs). */
export function CardTitle({ className = "", ...rest }: ComponentProps<"h2">) {
  return <h2 className={`m-0 font-display text-[30px] font-normal leading-none tracking-[0.03em] ${className}`} {...rest} />;
}

/** Small caps label ("YOUR STATUS", "7-DAY FORECAST"). */
export function Eyebrow({ className = "", ...rest }: ComponentProps<"div">) {
  return <div className={`text-[13px] font-semibold tracking-[0.1em] text-muted uppercase ${className}`} {...rest} />;
}

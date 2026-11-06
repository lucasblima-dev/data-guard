import { motion, type HTMLMotionProps } from "framer-motion";
import { press } from "../../lib/motion";

type Variant = "primary" | "ghost" | "glass";

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-[0_1px_0_rgb(255_255_255/0.2)_inset,0_6px_16px_-6px_var(--color-accent)] hover:brightness-110",
  ghost: "text-fg-muted hover:text-fg hover:bg-fg/5",
  glass: "glass text-fg hover:border-line-strong",
};

export function Button({ variant = "glass", className = "", ...rest }: ButtonProps) {
  return (
    <motion.button
      {...press}
      className={`focus-ring inline-flex h-8 items-center justify-center gap-2 rounded-control px-3 text-sm font-medium transition-[color,background-color,filter] disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}

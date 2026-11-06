import { motion, type HTMLMotionProps } from "framer-motion";
import { fadeUp } from "../../lib/motion";

interface CardProps extends HTMLMotionProps<"div"> {
  /** Vidro mais opaco/desfocado, para elementos sobrepostos (header, modais). */
  strong?: boolean;
  /** Eleva levemente no hover (cards clicaveis). */
  interactive?: boolean;
}

export function Card({ strong = false, interactive = false, className = "", ...rest }: CardProps) {
  return (
    <motion.div
      variants={fadeUp}
      whileHover={interactive ? { y: -2 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 32 }}
      className={`${strong ? "glass-strong" : "glass"} rounded-card ${
        interactive ? "transition-colors hover:border-line-strong" : ""
      } ${className}`}
      {...rest}
    />
  );
}

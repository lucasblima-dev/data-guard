import { motion, type HTMLMotionProps } from "framer-motion";
import { fadeUp, tweenSnap } from "../../lib/motion";

interface CardProps extends HTMLMotionProps<"div"> {
  /** Vidro mais opaco/desfocado, para elementos sobrepostos (header, modais). */
  strong?: boolean;
  /** Realca a borda no hover (cards clicaveis). */
  interactive?: boolean;
}

export function Card({ strong = false, interactive = false, className = "", ...rest }: CardProps) {
  return (
    <motion.div
      variants={fadeUp}
      transition={tweenSnap}
      className={`${strong ? "glass-strong" : "glass"} rounded-card ${
        interactive ? "transition-colors duration-150 hover:border-line-strong" : ""
      } ${className}`}
      {...rest}
    />
  );
}

import { motion, AnimatePresence } from "framer-motion";

interface LiveCounterProps {
  value: number | string;
  className?: string;
}

export function LiveCounter({ value, className }: LiveCounterProps) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.span
        key={value}
        initial={{ scale: 1.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className={className}
      >
        {value}
      </motion.span>
    </AnimatePresence>
  );
}

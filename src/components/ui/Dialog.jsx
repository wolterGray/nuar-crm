import clsx from "clsx";
import {AnimatePresence, motion, useReducedMotion} from "framer-motion";

export function Dialog({open, children}) {
  return (
    <AnimatePresence>
      {open ? children : null}
    </AnimatePresence>
  );
}

export function DialogBackdrop({className, ...props}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate={{opacity: 1}}
      className={clsx(
          "fixed inset-0 z-50 grid place-items-center p-4 bg-overlay backdrop-blur-md",
          className,
        )}
      exit={{opacity: 0}}
      initial={{opacity: 0}}
      role="presentation"
      transition={{duration: shouldReduceMotion ? 0.08 : 0.16, ease: "easeOut"}}
      {...props}
    />
  );
}

export function DialogContent({className, ...props}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      animate={shouldReduceMotion ? {opacity: 1} : {opacity: 1, scale: 1, y: 0}}
      aria-modal="true"
      className={clsx(
          "w-full max-w-md p-5 border border-border rounded-modal text-textPrimary bg-surface shadow-modal",
          className,
        )}
      exit={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.96, y: 8}}
      initial={shouldReduceMotion ? {opacity: 0} : {opacity: 0, scale: 0.94, y: 14}}
      role="dialog"
      transition={{
        damping: 30,
        duration: shouldReduceMotion ? 0.08 : undefined,
        mass: 0.85,
        stiffness: 420,
        type: "spring",
      }}
      {...props}
    />
  );
}

export function DialogHeader({className, ...props}) {
  return <div className={clsx("grid gap-2", className)} {...props} />;
}

export function DialogTitle({className, ...props}) {
  return (
    <h2 className={clsx("m-0 text-textPrimary text-2xl font-semibold", className)} {...props} />
  );
}

export function DialogDescription({className, ...props}) {
  return (
    <p
      className={clsx("text-textSecondary text-sm leading-normal", className)}
      {...props}
    />
  );
}

export function DialogFooter({className, ...props}) {
  return (
    <div
      className={clsx("flex justify-end gap-2 mt-5", className)}
      {...props}
    />
  );
}

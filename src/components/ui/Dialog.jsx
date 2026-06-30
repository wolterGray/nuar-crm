import clsx from "clsx";

export function Dialog({open, children}) {
  if (!open) {
    return null;
  }

  return children;
}

export function DialogBackdrop({className, ...props}) {
  return (
    <div
      className={clsx(
          "fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-md",
          className,
        )}
      role="presentation"
      {...props}
    />
  );
}

export function DialogContent({className, ...props}) {
  return (
    <section
      aria-modal="true"
      className={clsx(
          "w-full max-w-md p-5 border border-border rounded-modal text-text-main bg-surface shadow-layer",
          className,
        )}
      role="dialog"
      {...props}
    />
  );
}

export function DialogHeader({className, ...props}) {
  return <div className={clsx("grid gap-2", className)} {...props} />;
}

export function DialogTitle({className, ...props}) {
  return (
    <h2
      className={clsx("m-0 text-text-main text-2xl font-semibold", className)}
      {...props}
    />
  );
}

export function DialogDescription({className, ...props}) {
  return (
    <p
      className={clsx("text-text-muted text-sm leading-normal", className)}
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

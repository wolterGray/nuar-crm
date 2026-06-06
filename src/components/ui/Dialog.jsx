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
        "fixed inset-0 z-[80] grid place-items-center bg-neutral-950/35 p-4 backdrop-blur-sm",
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
        "w-full max-w-md rounded-lg border border-neutral-200 bg-white p-5 text-neutral-950 shadow-xl",
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
      className={clsx("text-base font-semibold leading-6 text-neutral-950", className)}
      {...props}
    />
  );
}

export function DialogDescription({className, ...props}) {
  return (
    <p
      className={clsx("text-sm leading-6 text-neutral-500", className)}
      {...props}
    />
  );
}

export function DialogFooter({className, ...props}) {
  return (
    <div
      className={clsx("mt-5 flex justify-end gap-2", className)}
      {...props}
    />
  );
}

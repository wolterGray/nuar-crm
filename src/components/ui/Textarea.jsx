import {forwardRef} from "react";
import clsx from "clsx";

const Textarea = forwardRef(({className, rows = 3, ...props}, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(
        "w-full py-2.5 px-3 border border-border rounded-control text-text-main bg-field font-normal text-sm transition-all duration-150 placeholder:text-text-faint focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed resize-y",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export default Textarea;

import {forwardRef} from "react";
import clsx from "clsx";

const Textarea = forwardRef(({className, rows = 3, ...props}, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx(
        "w-full py-3 md:py-2.5 px-4 md:px-3 border border-border rounded-control text-textPrimary bg-field font-normal text-base md:text-sm transition-all duration-150 placeholder:text-textMuted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed resize-y",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export default Textarea;

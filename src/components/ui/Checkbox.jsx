import {forwardRef} from "react";
import clsx from "clsx";

const Checkbox = forwardRef(({className, ...props}, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={clsx(
      "ui-checkbox",
      className,
    )}
    {...props}
  />
));

Checkbox.displayName = "Checkbox";

export default Checkbox;

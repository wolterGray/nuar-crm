import {forwardRef} from "react";
import clsx from "clsx";

const Switch = forwardRef(({className, ...props}, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={clsx(
      "ui-switch",
      className,
    )}
    {...props}
  />
));

Switch.displayName = "Switch";

export default Switch;

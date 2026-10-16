import {forwardRef, useEffect, useRef} from "react";
import clsx from "clsx";

const Checkbox = forwardRef(({className, indeterminate = false, ...props}, ref) => {
  const localRef = useRef(null);
  const targetRef = ref || localRef;

  useEffect(() => {
    if (targetRef && "current" in targetRef && targetRef.current) {
      targetRef.current.indeterminate = Boolean(indeterminate);
    }
  }, [indeterminate, targetRef]);

  return (
    <input
      ref={targetRef}
      type="checkbox"
      className={clsx(
        "ui-checkbox",
        className,
      )}
      style={{
        width: 18,
        height: 18,
        minWidth: 18,
        minHeight: 18,
        flexShrink: 0,
        ...props.style,
      }}
      {...props}
    />
  );
});

Checkbox.displayName = "Checkbox";

export default Checkbox;

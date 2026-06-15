import {useEffect} from "react";

let lockCount = 0;
let previousBodyOverflow = "";
let previousHtmlOverflow = "";

export function useModalScrollLock(modalOpen) {
  useEffect(() => {
    if (!modalOpen) {
      return undefined;
    }

    if (lockCount === 0) {
      previousBodyOverflow = document.body.style.overflow;
      previousHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    lockCount += 1;

    return () => {
      lockCount = Math.max(0, lockCount - 1);

      if (lockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      }
    };
  }, [modalOpen]);
}

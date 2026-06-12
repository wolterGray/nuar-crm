import {useCallback, useEffect, useState} from "react";

export function useClientSearch() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }

      event.preventDefault();
      toggle();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  return {
    close,
    isOpen,
    open,
    setIsOpen,
    toggle,
  };
};

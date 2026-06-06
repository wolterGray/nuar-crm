import {useEffect, useState} from "react";

const defaultDeserialize = (value) => JSON.parse(value);
const defaultSerialize = (value) => JSON.stringify(value);

export function usePersistentState(key, initialValue, options = {}) {
  const {
    deserialize = defaultDeserialize,
    serialize = defaultSerialize,
  } = options;

  const [state, setState] = useState(() => {
    try {
      const storedValue = window.localStorage.getItem(key);

      if (storedValue === null) {
        return typeof initialValue === "function" ? initialValue() : initialValue;
      }

      return deserialize(storedValue);
    } catch {
      return typeof initialValue === "function" ? initialValue() : initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serialize(state));
    } catch {
      // localStorage can be unavailable in private mode; keep state in memory.
    }
  }, [key, serialize, state]);

  return [state, setState];
}

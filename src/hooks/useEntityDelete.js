import {useCallback, useState} from "react";

export function useEntityDelete({onConfirmDelete}) {
  const [pendingEntityDelete, setPendingEntityDelete] = useState(null);

  const requestEntityDelete = useCallback((type, entity) => {
    setPendingEntityDelete({entity, type});
  }, []);

  const cancelEntityDelete = useCallback(() => {
    setPendingEntityDelete(null);
  }, []);

  const confirmEntityDelete = useCallback(() => {
    if (!pendingEntityDelete) {
      return;
    }

    onConfirmDelete(pendingEntityDelete);
    setPendingEntityDelete(null);
  }, [onConfirmDelete, pendingEntityDelete]);

  return {
    cancelEntityDelete,
    confirmEntityDelete,
    pendingEntityDelete,
    requestEntityDelete,
  };
}

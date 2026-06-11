import {useCallback} from "react";
import {getRandomServiceColor} from "../utils/serviceColors.js";

export function useServiceHandlers({
  createLocalId,
  editingPackage,
  editingService,
  pushNotification,
  requestEntityDelete,
  setCalendarEntries,
  setClientPackages,
  setEditingPackage,
  setEditingService,
  setPackageModalOpen,
  setPackagesCatalog,
  setServiceCatalog,
  setServiceModalOpen,
  setVisits,
}) {
  const openCreateService = useCallback(() => {
    setEditingService(null);
    setServiceModalOpen(true);
  }, [setEditingService, setServiceModalOpen]);

  const openEditService = useCallback(
    (service) => {
      setEditingService(service);
      setServiceModalOpen(true);
    },
    [setEditingService, setServiceModalOpen],
  );

  const handleServiceSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const previousName = editingService?.name;

      if (!name) {
        return;
      }

      const service = {
        id: editingService?.id ?? createLocalId(),
        name,
        category: String(form.get("category") ?? "").trim() || "Массаж",
        color: form.get("color") || editingService?.color || getRandomServiceColor(),
        variants: [60, 75, 90, 120]
          .map((duration) => ({
            duration,
            price: Number(form.get(`price_${duration}`)) || 0,
          }))
          .filter((variant) => variant.price > 0),
      };

      setServiceCatalog((current) =>
        editingService
          ? current.map((item) => (item.id === service.id ? service : item))
          : [service, ...current],
      );
      setCalendarEntries((current) =>
        current.map((entry) =>
          entry.serviceId === service.id
            ? {...entry, service: service.name, color: service.color}
            : entry,
        ),
      );

      if (previousName && previousName !== service.name) {
        setVisits((current) =>
          current.map((visit) =>
            visit.service === previousName
              ? {...visit, service: service.name}
              : visit,
          ),
        );
        setPackagesCatalog((current) =>
          current.map((packageItem) =>
            packageItem.service === previousName
              ? {...packageItem, service: service.name}
              : packageItem,
          ),
        );
        setClientPackages((current) =>
          current.map((packageItem) =>
            packageItem.service === previousName
              ? {...packageItem, service: service.name}
              : packageItem,
          ),
        );
      }

      setServiceModalOpen(false);
      setEditingService(null);
      pushNotification({
        title: editingService ? "Услуга обновлена" : "Услуга добавлена",
        message: `${service.name} сохранена в базе услуг`,
      });
    },
    [
      createLocalId,
      editingService,
      pushNotification,
      setCalendarEntries,
      setClientPackages,
      setEditingService,
      setPackagesCatalog,
      setServiceCatalog,
      setServiceModalOpen,
      setVisits,
    ],
  );

  const requestDeleteService = useCallback(
    (service) => {
      requestEntityDelete("service", service);
    },
    [requestEntityDelete],
  );

  const performDeleteService = useCallback(
    (service) => {
      setServiceCatalog((current) => current.filter((item) => item.id !== service.id));
      pushNotification({
        title: "Услуга удалена",
        message: `${service.name} удалена из базы услуг`,
      });
    },
    [pushNotification, setServiceCatalog],
  );

  const openCreatePackage = useCallback(() => {
    setEditingPackage(null);
    setPackageModalOpen(true);
  }, [setEditingPackage, setPackageModalOpen]);

  const openEditPackage = useCallback(
    (packageItem) => {
      setEditingPackage(packageItem);
      setPackageModalOpen(true);
    },
    [setEditingPackage, setPackageModalOpen],
  );

  const handlePackageSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();

      if (!name) {
        return;
      }

      const packageItem = {
        id: editingPackage?.id ?? createLocalId(),
        name,
        service: form.get("service"),
        visitsCount: Number(form.get("visitsCount")) || 0,
        price: Number(form.get("price")) || 0,
        validityDays: Number(form.get("validityDays")) || 0,
        status: form.get("status"),
      };

      setPackagesCatalog((current) =>
        editingPackage
          ? current.map((item) => (item.id === packageItem.id ? packageItem : item))
          : [packageItem, ...current],
      );
      setPackageModalOpen(false);
      setEditingPackage(null);
      pushNotification({
        title: editingPackage ? "Пакет обновлен" : "Пакет добавлен",
        message: `${packageItem.name} сохранен в базе пакетов`,
      });
    },
    [
      createLocalId,
      editingPackage,
      pushNotification,
      setEditingPackage,
      setPackageModalOpen,
      setPackagesCatalog,
    ],
  );

  const requestDeletePackage = useCallback(
    (packageItem) => {
      requestEntityDelete("package", packageItem);
    },
    [requestEntityDelete],
  );

  const performDeletePackage = useCallback(
    (packageItem) => {
      setPackagesCatalog((current) =>
        current.filter((item) => item.id !== packageItem.id),
      );
      pushNotification({
        title: "Пакет удален",
        message: `${packageItem.name} удален из базы пакетов`,
        undoAction: {
          type: "restore-package-template",
          payload: packageItem,
        },
      });
    },
    [pushNotification, setPackagesCatalog],
  );

  return {
    handlePackageSubmit,
    handleServiceSubmit,
    openCreatePackage,
    openCreateService,
    openEditPackage,
    openEditService,
    performDeletePackage,
    performDeleteService,
    requestDeletePackage,
    requestDeleteService,
  };
}

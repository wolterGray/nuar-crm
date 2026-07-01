import {useCallback} from "react";
import {
  createService,
  deleteService,
  updateService,
} from "../api/services.js";
import {getRandomServiceColor} from "../utils/serviceColors.js";
import {parseServiceBookingBuffersFromForm} from "../utils/siteBookingBuffers.js";

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
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const previousName = editingService?.name;

      if (!name) {
        return;
      }

      const service = {
        ...(editingService?.id ? {id: editingService.id} : {}),
        name,
        category: String(form.get("category") ?? "").trim() || "Массаж",
        color: form.get("color") || editingService?.color || getRandomServiceColor(),
        variants: [60, 75, 90, 120]
          .map((duration) => ({
            duration,
            price: Number(form.get(`price_${duration}`)) || 0,
          }))
          .filter((variant) => variant.price > 0),
        ...parseServiceBookingBuffersFromForm(form, editingService),
      };
      let savedService;

      try {
        const response = editingService
          ? await updateService(editingService.id, service)
          : await createService(service);
        savedService = response?.data ?? service;
      } catch (error) {
        pushNotification({
          title: "Услуга не сохранена",
          message: error?.message || "Backend не принял изменения услуги",
          persist: false,
        });
        return;
      }

      setServiceCatalog((current) =>
        editingService
          ? current.map((item) => (item.id === savedService.id ? savedService : item))
          : [savedService, ...current],
      );
      setCalendarEntries((current) =>
        current.map((entry) =>
          entry.serviceId === savedService.id
            ? {...entry, service: savedService.name, color: savedService.color}
            : entry,
        ),
      );

      if (previousName && previousName !== savedService.name) {
        setVisits((current) =>
          current.map((visit) =>
            visit.service === previousName
              ? {...visit, service: savedService.name}
              : visit,
          ),
        );
        setPackagesCatalog((current) =>
          current.map((packageItem) =>
            packageItem.service === previousName
              ? {...packageItem, service: savedService.name}
              : packageItem,
          ),
        );
        setClientPackages((current) =>
          current.map((packageItem) =>
            packageItem.service === previousName
              ? {...packageItem, service: savedService.name}
              : packageItem,
          ),
        );
      }

      setServiceModalOpen(false);
      setEditingService(null);
      pushNotification({
        title: editingService ? "Услуга обновлена" : "Услуга добавлена",
        message: `${savedService.name} сохранена в базе услуг`,
      });
    },
    [
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
    async (service) => {
      try {
        await deleteService(service.id);
      } catch (error) {
        pushNotification({
          title: "Услуга не удалена",
          message: error?.message || "Backend не удалил услугу",
          persist: false,
        });
        return;
      }

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

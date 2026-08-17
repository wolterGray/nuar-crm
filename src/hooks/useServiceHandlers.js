import {useCallback} from "react";
import {
  createService,
  deleteService,
  updateService,
} from "../api/services.js";
import {
  createPackage,
  deletePackage,
  updatePackage,
} from "../api/financial.js";
import {getRandomServiceColor} from "../utils/serviceColors.js";
import {parseServiceBookingBuffersFromForm} from "../utils/siteBookingBuffers.js";

const serviceDurations = [30, 60, 75, 90, 120];

export function useServiceHandlers({
  employees = [],
  editingPackage,
  editingService,
  pushNotification,
  requestEntityDelete,
  serviceCatalog = [],
  serviceCreateType = "service",
  setCalendarEntries,
  setClientPackages,
  setEditingPackage,
  setEditingService,
  setPackageModalOpen,
  setPackagesCatalog,
  setServiceCreateType,
  setServiceCatalog,
  setServiceModalOpen,
  setVisits,
}) {
  const openCreateService = useCallback((type = "service") => {
    setEditingService(null);
    setServiceCreateType(type === "combo" ? "combo" : "service");
    setServiceModalOpen(true);
  }, [setEditingService, setServiceCreateType, setServiceModalOpen]);

  const openEditService = useCallback(
    (service) => {
      setEditingService(service);
      setServiceCreateType(service?.payload?.serviceType ?? service?.serviceType ?? "service");
      setServiceModalOpen(true);
    },
    [setEditingService, setServiceCreateType, setServiceModalOpen],
  );

  const handleServiceSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const previousName = editingService?.name;
      const assignedEmployeeIds = form
        .getAll("assignedEmployeeIds")
        .map((value) => String(value).trim())
        .filter(Boolean);
      const assignedEmployeeNames = employees
        .filter((employee) => assignedEmployeeIds.includes(String(employee.id)))
        .map((employee) => employee.name)
        .filter(Boolean);

      if (!name) {
        return;
      }

      const submittedServiceType = String(
        form.get("serviceType") ?? editingService?.payload?.serviceType ?? serviceCreateType,
      );
      const isCombo = submittedServiceType === "combo";
      const comboItems = isCombo
        ? Array.from({length: 6}, (_, index) => {
            const serviceId = String(form.get(`combo_service_${index}`) ?? "").trim();
            if (!serviceId) return null;

            const catalogService =
              serviceCatalog.find((item) => String(item.id) === serviceId) ??
              editingService?.payload?.comboItems?.find(
                (item) => String(item.serviceId) === serviceId,
              ) ??
              null;
            const duration = Number(form.get(`combo_duration_${index}`)) || 60;
            const price = Math.max(0, Number(form.get(`combo_price_${index}`)) || 0);

            return {
              serviceId: Number(serviceId) || serviceId,
              serviceName: catalogService?.name ?? catalogService?.serviceName ?? "",
              duration,
              price,
            };
          }).filter(Boolean)
        : [];
      const comboTotalPrice = comboItems.reduce((total, item) => total + item.price, 0);
      const comboDuration = comboItems.reduce(
        (maxDuration, item) => Math.max(maxDuration, Number(item.duration) || 0),
        0,
      );

      const service = isCombo ? {
        ...(editingService?.id ? {id: editingService.id} : {}),
        name,
        category: String(form.get("category") ?? "").trim() || "Комплексы",
        description: String(form.get("description") ?? "").trim(),
        color: form.get("color") || editingService?.color || getRandomServiceColor(),
        serviceType: "combo",
        isParallel: true,
        parallelParticipants: Math.max(2, comboItems.length || 2),
        comboItems,
        comboCustomPrice: form.get("comboCustomPrice") === "on",
        variants: comboItems.length > 0
          ? [{
              duration: comboDuration || 60,
              price: comboTotalPrice,
              participantPrices: comboItems.map((item) => item.price),
              comboItems,
            }]
          : [],
      } : {
        ...(editingService?.id ? {id: editingService.id} : {}),
        name,
        category: String(form.get("category") ?? "").trim() || "Массаж",
        color: form.get("color") || editingService?.color || getRandomServiceColor(),
        serviceType: "service",
        isParallel: false,
        parallelParticipants: 1,
        assignedEmployeeIds,
        assignedEmployeeNames,
        variants: serviceDurations
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
      setServiceCreateType("service");
      pushNotification({
        title: editingService ? "Услуга обновлена" : "Услуга добавлена",
        message: `${savedService.name} сохранена в базе услуг`,
      });
    },
    [
      editingService,
      employees,
      pushNotification,
      serviceCreateType,
      serviceCatalog,
      setCalendarEntries,
      setClientPackages,
      setEditingService,
      setPackagesCatalog,
      setServiceCreateType,
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
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();

      if (!name) {
        return;
      }

      const packageItem = {
        ...(editingPackage?.id ? {id: editingPackage.id} : {}),
        name,
        service: form.get("service"),
        visitsCount: Number(form.get("visitsCount")) || 0,
        price: Number(form.get("price")) || 0,
        validityDays: Number(form.get("validityDays")) || 0,
        status: form.get("status"),
      };
      let savedPackage;

      try {
        const response = editingPackage
          ? await updatePackage(editingPackage.id, packageItem)
          : await createPackage(packageItem);
        savedPackage = response?.data ?? packageItem;
      } catch (error) {
        pushNotification({
          title: editingPackage ? "Пакет не обновлен" : "Пакет не добавлен",
          message: error?.message || "Backend не принял пакет",
          persist: false,
        });
        return;
      }

      setPackagesCatalog((current) =>
        editingPackage
          ? current.map((item) => (item.id === savedPackage.id ? savedPackage : item))
          : [savedPackage, ...current],
      );
      setPackageModalOpen(false);
      setEditingPackage(null);
      pushNotification({
        title: editingPackage ? "Пакет обновлен" : "Пакет добавлен",
        message: `${savedPackage.name} сохранен в базе пакетов`,
      });
    },
    [
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
    async (packageItem) => {
      try {
        await deletePackage(packageItem.id);
      } catch (error) {
        pushNotification({
          title: "Пакет не удален",
          message: error?.message || "Backend не удалил пакет",
          persist: false,
        });
        return;
      }

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

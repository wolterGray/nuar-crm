import {useCallback} from "react";
import {
  createService,
  deleteService,
  reorderServices,
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
const UNCATEGORIZED_SERVICE_CATEGORY = "Без категории";

const getVariantPrice = (service, duration) =>
  Math.max(
    0,
    Number(
      service?.variants?.find((variant) => Number(variant.duration) === Number(duration))?.price,
    ) || 0,
  );

const normalizeCategoryName = (value) => String(value ?? "").trim();

const moveItem = (items, activeId, overId) => {
  const fromIndex = items.findIndex((item) => String(item.id) === String(activeId));
  const toIndex = items.findIndex((item) => String(item.id) === String(overId));

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

const mergeVisibleServiceOrder = (services, reorderedVisibleServices) => {
  const visibleIds = new Set(reorderedVisibleServices.map((service) => String(service.id)));
  let visibleIndex = 0;

  return services.map((service) => {
    if (!visibleIds.has(String(service.id))) {
      return service;
    }

    const nextService = reorderedVisibleServices[visibleIndex] ?? service;
    visibleIndex += 1;
    return nextService;
  });
};

const withServiceSortOrder = (services) =>
  services.map((service, index) => ({
    ...service,
    sortOrder: index,
  }));

const withServiceCategory = (service, category) => {
  const payload = service?.payload && typeof service.payload === "object" ? service.payload : {};
  const storedFields = Object.fromEntries(
    Object.entries(service ?? {}).filter(
      ([key]) => !["payload", "createdAt", "updatedAt"].includes(key),
    ),
  );

  return {
    ...payload,
    ...storedFields,
    category,
  };
};

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
  setServiceCategories,
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

  const createServiceCategory = useCallback(
    (name) => {
      const category = normalizeCategoryName(name);
      if (!category) return false;

      let created = false;
      setServiceCategories((current) => {
        if (current.some((item) => item.toLowerCase() === category.toLowerCase())) {
          return current;
        }
        created = true;
        return [...current, category].sort((left, right) => left.localeCompare(right, "ru"));
      });

      if (created) {
        pushNotification({
          title: "Категория создана",
          message: category,
          persist: false,
        });
      }

      return created;
    },
    [pushNotification, setServiceCategories],
  );

  const moveServiceToCategory = useCallback(
    async (service, nextCategoryValue) => {
      const nextCategory = normalizeCategoryName(nextCategoryValue) || UNCATEGORIZED_SERVICE_CATEGORY;
      const nextService = withServiceCategory(service, nextCategory);

      try {
        const response = await updateService(service.id, nextService);
        const savedService = response?.data ?? nextService;
        setServiceCatalog((current) =>
          current.map((item) => (item.id === service.id ? savedService : item)),
        );
        setServiceCategories((current) =>
          current.some((item) => item.toLowerCase() === nextCategory.toLowerCase())
            ? current
            : [...current, nextCategory].sort((left, right) => left.localeCompare(right, "ru")),
        );
      } catch (error) {
        pushNotification({
          title: "Категория не изменена",
          message: error?.message || "Backend не перенёс услугу",
          persist: false,
        });
      }
    },
    [pushNotification, setServiceCatalog, setServiceCategories],
  );

  const renameServiceCategory = useCallback(
    async (categoryValue, nextCategoryValue) => {
      const category = normalizeCategoryName(categoryValue);
      const nextCategory = normalizeCategoryName(nextCategoryValue);
      if (!category || !nextCategory || category === nextCategory) return;

      const affectedServices = serviceCatalog.filter(
        (service) => normalizeCategoryName(service.category) === category,
      );

      try {
        const savedServices = await Promise.all(
          affectedServices.map((service) =>
            updateService(service.id, withServiceCategory(service, nextCategory)).then(
              (response) => response?.data ?? withServiceCategory(service, nextCategory),
            ),
          ),
        );
        const savedById = new Map(savedServices.map((service) => [service.id, service]));

        setServiceCatalog((current) =>
          current.map((service) =>
            savedById.get(service.id) ??
            (normalizeCategoryName(service.category) === category
              ? withServiceCategory(service, nextCategory)
              : service),
          ),
        );
        setServiceCategories((current) => {
          const next = current
            .filter((item) => item.toLowerCase() !== category.toLowerCase())
            .concat(nextCategory);
          return [...new Set(next)].sort((left, right) => left.localeCompare(right, "ru"));
        });
        pushNotification({
          title: "Категория переименована",
          message: affectedServices.length
            ? `Перенесено услуг: ${affectedServices.length}`
            : nextCategory,
          persist: false,
        });
      } catch (error) {
        pushNotification({
          title: "Категория не переименована",
          message: error?.message || "Backend не обновил услуги категории",
          persist: false,
        });
      }
    },
    [pushNotification, serviceCatalog, setServiceCatalog, setServiceCategories],
  );

  const deleteServiceCategory = useCallback(
    async (categoryValue) => {
      const category = normalizeCategoryName(categoryValue);
      if (!category) return;

      const affectedServices = serviceCatalog.filter(
        (service) => normalizeCategoryName(service.category) === category,
      );
      const targetCategory = UNCATEGORIZED_SERVICE_CATEGORY;

      try {
        const savedServices = await Promise.all(
          affectedServices.map((service) =>
            updateService(service.id, withServiceCategory(service, targetCategory)).then(
              (response) => response?.data ?? withServiceCategory(service, targetCategory),
            ),
          ),
        );
        const savedById = new Map(savedServices.map((service) => [service.id, service]));

        setServiceCatalog((current) =>
          current.map((service) =>
            savedById.get(service.id) ??
            (normalizeCategoryName(service.category) === category
              ? withServiceCategory(service, targetCategory)
              : service),
          ),
        );
        setServiceCategories((current) => {
          const next = current.filter(
            (item) => item.toLowerCase() !== category.toLowerCase(),
          );
          return affectedServices.length > 0 && !next.includes(targetCategory)
            ? [...next, targetCategory]
            : next;
        });
        pushNotification({
          title: "Категория удалена",
          message: affectedServices.length
            ? `Услуги перенесены в "${targetCategory}": ${affectedServices.length}`
            : category,
          persist: false,
        });
      } catch (error) {
        pushNotification({
          title: "Категория не удалена",
          message: error?.message || "Backend не перенёс услуги категории",
          persist: false,
        });
      }
    },
    [pushNotification, serviceCatalog, setServiceCatalog, setServiceCategories],
  );

  const reorderServiceCatalog = useCallback(
    async (activeServiceId, overServiceId, visibleServiceIds = []) => {
      if (!activeServiceId || !overServiceId || String(activeServiceId) === String(overServiceId)) {
        return;
      }

      const previousCatalog = serviceCatalog;
      const visibleIdSet = new Set(visibleServiceIds.map((id) => String(id)));
      const visibleServices = serviceCatalog.filter((service) =>
        visibleIdSet.size > 0 ? visibleIdSet.has(String(service.id)) : true,
      );
      const reorderedVisibleServices = moveItem(visibleServices, activeServiceId, overServiceId);
      const nextCatalog = withServiceSortOrder(
        mergeVisibleServiceOrder(serviceCatalog, reorderedVisibleServices),
      );

      setServiceCatalog(nextCatalog);

      try {
        const response = await reorderServices(nextCatalog.map((service) => service.id));
        setServiceCatalog(response?.data ?? nextCatalog);
        pushNotification({
          title: "Порядок услуг сохранен",
          message: "Каталог обновлен",
          persist: false,
        });
      } catch (error) {
        setServiceCatalog(previousCatalog);
        pushNotification({
          title: "Порядок не сохранен",
          message: error?.message || "Backend не обновил порядок услуг",
          persist: false,
        });
      }
    },
    [pushNotification, serviceCatalog, setServiceCatalog],
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
      const comboIndexes = isCombo
        ? [...new Set(
            Array.from(form.keys())
              .map((key) => /^combo_service_(\d+)$/.exec(key)?.[1])
              .filter(Boolean),
          )].map(Number).sort((left, right) => left - right)
        : [];
      const comboItems = isCombo
        ? comboIndexes.map((index) => {
            const serviceId = String(form.get(`combo_service_${index}`) ?? "").trim();
            if (!serviceId) return null;

            const catalogService =
              serviceCatalog.find((item) => String(item.id) === serviceId) ??
              editingService?.payload?.comboItems?.find(
                (item) => String(item.serviceId) === serviceId,
              ) ??
              null;
            const duration = Number(form.get(`combo_duration_${index}`)) || 60;
            const usesCustomPrice = form.get("comboCustomPrice") === "on";
            const price = usesCustomPrice
              ? Math.max(0, Number(form.get(`combo_price_${index}`)) || 0)
              : getVariantPrice(catalogService, duration);

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
        sortOrder:
          editingService?.sortOrder !== undefined && editingService?.sortOrder !== null
            ? editingService.sortOrder
            : serviceCatalog.length,
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
        sortOrder:
          editingService?.sortOrder !== undefined && editingService?.sortOrder !== null
            ? editingService.sortOrder
            : serviceCatalog.length,
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
      if (isCombo && comboItems.length < 2) {
        pushNotification({
          title: "Комплекс не сохранен",
          message: "Выберите минимум две услуги для комплекса.",
          persist: false,
        });
        return;
      }
      if (isCombo && comboTotalPrice <= 0) {
        pushNotification({
          title: "Комплекс не сохранен",
          message: "У комплекса должна быть цена: выберите услуги с ценой или включите свою цену.",
          persist: false,
        });
        return;
      }
      if (!isCombo && service.variants.length === 0) {
        pushNotification({
          title: "Услуга не сохранена",
          message: "Добавьте хотя бы одну цену и длительность услуги.",
          persist: false,
        });
        return;
      }
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
          : withServiceSortOrder([...current, savedService]),
      );
      setServiceCategories((current) => {
        const category = normalizeCategoryName(savedService.category);
        if (!category || current.some((item) => item.toLowerCase() === category.toLowerCase())) {
          return current;
        }
        return [...current, category].sort((left, right) => left.localeCompare(right, "ru"));
      });
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
      setServiceCategories,
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
    createServiceCategory,
    deleteServiceCategory,
    handlePackageSubmit,
    handleServiceSubmit,
    moveServiceToCategory,
    openCreatePackage,
    openCreateService,
    openEditPackage,
    openEditService,
    performDeletePackage,
    performDeleteService,
    renameServiceCategory,
    reorderServiceCatalog,
    requestDeletePackage,
    requestDeleteService,
  };
}

import {useCallback} from "react";
import {
  attachClientLink,
  matchesClientRecord,
  remapClientRecords,
} from "../utils/clientLinks.js";
import {resolveClientPackageStatus} from "../utils/clientPackages.js";
import {toDisplayDate} from "../utils/formatters.jsx";
import {getPackageProgressLabel} from "../utils/packages.jsx";
import {getTodayInput} from "../utils/dateHelpers.js";

export function useClientHandlers({
  clientProfiles,
  createLocalId,
  editingClient,
  editingClientPackage,
  openCreateCalendarEntry,
  packagesCatalog,
  pushNotification,
  requestEntityDelete,
  setActivePage,
  setCalendarEntries,
  setClientModalOpen,
  setClientPackageModalOpen,
  setClientPackages,
  setClientProfiles,
  setEditingClient,
  setEditingClientPackage,
  setVisits,
}) {
  const openCreateClient = useCallback(
    (prefill = {}) => {
      setEditingClient(
        prefill?.name
          ? {
              name: prefill.name,
              source: "Instagram",
              preference: "Любой мастер",
              status: "Новый",
            }
          : null,
      );
      setClientModalOpen(true);
    },
    [setClientModalOpen, setEditingClient],
  );

  const openEditClient = useCallback(
    (client) => {
      setEditingClient(client);
      setClientModalOpen(true);
    },
    [setClientModalOpen, setEditingClient],
  );

  const updateClientNote = useCallback(
    (client, note) => {
      const trimmedNote = String(note ?? "").trim();

      setClientProfiles((current) =>
        current.map((item) =>
          item.id === client.id ? {...item, note: trimmedNote} : item,
        ),
      );
    },
    [setClientProfiles],
  );

  const handleClientSubmit = useCallback(
    (eventOrForm) => {
      eventOrForm.preventDefault?.();
      const formElement = eventOrForm.currentTarget ?? eventOrForm;
      const form = new FormData(formElement);
      const name = String(form.get("name") ?? "").trim();
      const previousName = editingClient?.name;

      if (!name) {
        return;
      }

      const client = {
        id: editingClient?.id ?? createLocalId(),
        name,
        phone: String(form.get("phone") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        birthday: String(form.get("birthday") ?? "").trim(),
        instagram: String(form.get("instagram") ?? "").trim(),
        telegram: String(form.get("telegram") ?? "").trim(),
        source: form.get("source"),
        preference: form.get("preference"),
        status: form.get("status") || "Активный",
        tags: String(form.get("tags") ?? "").trim(),
        note: String(form.get("note") ?? "").trim(),
      };

      setClientProfiles((current) =>
        editingClient
          ? current.map((item) => (item.id === client.id ? client : item))
          : [client, ...current],
      );

      if (previousName && previousName !== client.name) {
        const previousClient = {...client, name: previousName};

        setVisits((current) =>
          remapClientRecords(current, clientProfiles, previousClient, client),
        );
        setClientPackages((current) =>
          remapClientRecords(current, clientProfiles, previousClient, client),
        );
        setCalendarEntries((current) =>
          remapClientRecords(current, clientProfiles, previousClient, client, {
            visitOnly: true,
          }),
        );
      }

      setClientModalOpen(false);
      setEditingClient(null);
      pushNotification({
        title: editingClient ? "Клиент обновлен" : "Клиент добавлен",
        message: `${client.name} сохранен в базе клиентов`,
      });
    },
    [
      clientProfiles,
      createLocalId,
      editingClient,
      pushNotification,
      setCalendarEntries,
      setClientModalOpen,
      setClientPackages,
      setClientProfiles,
      setEditingClient,
      setVisits,
    ],
  );

  const requestDeleteClient = useCallback(
    (client) => {
      requestEntityDelete("client", client);
    },
    [requestEntityDelete],
  );

  const performDeleteClient = useCallback(
    (client) => {
      setClientProfiles((current) => current.filter((item) => item.id !== client.id));
      setClientPackages((current) =>
        current.filter(
          (packageItem) => !matchesClientRecord(packageItem, clientProfiles, client),
        ),
      );
      pushNotification({
        title: "Клиент удален",
        message: `${client.name} удален из базы клиентов`,
      });
    },
    [clientProfiles, pushNotification, setClientPackages, setClientProfiles],
  );

  const addClientCalendarVisit = useCallback(
    (client) => {
      setActivePage("calendar");
      openCreateCalendarEntry({
        client: client.name,
        clientId: client.id,
        date: getTodayInput(),
        kind: "visit",
        time: "10:00",
      });
    },
    [openCreateCalendarEntry, setActivePage],
  );

  const addCalendarFormClient = useCallback(
    (name) => {
      const trimmedName = String(name ?? "").trim();

      if (!trimmedName) {
        return;
      }

      const exists = clientProfiles.some(
        (client) => client.name.toLowerCase() === trimmedName.toLowerCase(),
      );

      if (exists) {
        return;
      }

      setClientProfiles((current) => [
        {
          id: createLocalId(),
          name: trimmedName,
          phone: "",
          email: "",
          birthday: "",
          instagram: "",
          telegram: "",
          source: "Визит",
          preference: "Любой мастер",
          status: "Новый",
          tags: "",
          note: "",
        },
        ...current,
      ]);
      pushNotification({
        title: "Клиент добавлен",
        message: `${trimmedName} теперь в базе клиентов`,
      });
    },
    [clientProfiles, createLocalId, pushNotification, setClientProfiles],
  );

  const openCreateClientPackage = useCallback(() => {
    setEditingClientPackage(null);
    setClientPackageModalOpen(true);
  }, [setClientPackageModalOpen, setEditingClientPackage]);

  const openEditClientPackage = useCallback(
    (packageItem) => {
      setEditingClientPackage(packageItem);
      setClientPackageModalOpen(true);
    },
    [setClientPackageModalOpen, setEditingClientPackage],
  );

  const handleClientPackageSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const packageTemplateId = Number(form.get("packageTemplateId"));
      const packageTemplate = packagesCatalog.find(
        (packageItem) => packageItem.id === packageTemplateId,
      );

      if (!packageTemplate && !editingClientPackage) {
        return;
      }

      const totalVisits =
        Number(form.get("totalVisits")) ||
        packageTemplate?.visitsCount ||
        editingClientPackage?.totalVisits ||
        0;
      const remainingVisits = Number(form.get("remainingVisits")) || 0;
      const clientPackage = attachClientLink(clientProfiles, {
        id: editingClientPackage?.id ?? createLocalId(),
        client: form.get("client"),
        packageId: packageTemplate?.id ?? editingClientPackage?.packageId,
        packageName:
          packageTemplate?.name ?? editingClientPackage?.packageName ?? "",
        service: packageTemplate?.service ?? editingClientPackage?.service ?? "",
        master: form.get("master") || editingClientPackage?.master || "",
        totalVisits,
        remainingVisits: Math.min(remainingVisits, totalVisits),
        price: Number(form.get("price")) || packageTemplate?.price || 0,
        purchaseDate: toDisplayDate(form.get("purchaseDate")),
        payment: form.get("payment"),
        status: resolveClientPackageStatus(
          Math.min(remainingVisits, totalVisits),
          form.get("status"),
        ),
      });

      setClientPackages((current) =>
        editingClientPackage
          ? current.map((item) =>
              item.id === clientPackage.id ? clientPackage : item,
            )
          : [clientPackage, ...current],
      );
      setClientPackageModalOpen(false);
      setEditingClientPackage(null);
      pushNotification({
        title: editingClientPackage ? "Остаток обновлен" : "Пакет продан",
        message: `${clientPackage.client}: использовано ${getPackageProgressLabel(clientPackage)}`,
      });
    },
    [
      clientProfiles,
      createLocalId,
      editingClientPackage,
      packagesCatalog,
      pushNotification,
      setClientPackageModalOpen,
      setClientPackages,
      setEditingClientPackage,
    ],
  );

  const requestDeleteClientPackage = useCallback(
    (packageItem) => {
      requestEntityDelete("clientPackage", packageItem);
    },
    [requestEntityDelete],
  );

  const performDeleteClientPackage = useCallback(
    (packageItem) => {
      setClientPackages((current) =>
        current.filter((item) => item.id !== packageItem.id),
      );
      pushNotification({
        title: "Пакет клиента удален",
        message: `${packageItem.client}: ${packageItem.packageName}`,
        undoAction: {
          type: "restore-client-package",
          payload: packageItem,
        },
      });
    },
    [pushNotification, setClientPackages],
  );

  return {
    addCalendarFormClient,
    addClientCalendarVisit,
    handleClientPackageSubmit,
    handleClientSubmit,
    openCreateClient,
    openCreateClientPackage,
    openEditClient,
    openEditClientPackage,
    performDeleteClient,
    performDeleteClientPackage,
    requestDeleteClient,
    requestDeleteClientPackage,
    updateClientNote,
  };
}

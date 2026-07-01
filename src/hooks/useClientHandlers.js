import {useCallback} from "react";
import {
  attachClientLink,
  matchesClientRecord,
  remapClientRecords,
} from "../utils/clientLinks.js";
import {matchesCertificateClient} from "../utils/certificates.js";
import {resolveClientPackageStatus} from "../utils/clientPackages.js";
import {toDisplayDate} from "../utils/formatters.jsx";
import {getPackageProgressLabel} from "../utils/packages.jsx";
import {getTodayInput} from "../utils/dateHelpers.js";
import {
  createClient,
  deleteClient,
  updateClient,
} from "../api/clients.js";
import {
  createClientPackage,
  deleteClientPackage,
  updateClientPackage,
} from "../api/financial.js";

export function useClientHandlers({
  clientProfiles,
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
  setCertificates,
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
              messageLanguage: "Польский",
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
    async (client, note) => {
      const trimmedNote = String(note ?? "").trim();
      const nextClient = {...client, note: trimmedNote};

      try {
        const response = await updateClient(client.id, nextClient);
        const savedClient = response?.data ?? nextClient;
        setClientProfiles((current) =>
          current.map((item) => (item.id === client.id ? savedClient : item)),
        );
      } catch (error) {
        pushNotification({
          title: "Заметка не сохранена",
          message: error?.message || "Не удалось обновить клиента в backend",
          persist: false,
        });
      }
    },
    [pushNotification, setClientProfiles],
  );

  const handleClientSubmit = useCallback(
    async (eventOrForm) => {
      eventOrForm.preventDefault?.();
      const formElement = eventOrForm.currentTarget ?? eventOrForm;
      const form = new FormData(formElement);
      const name = String(form.get("name") ?? "").trim();
      const previousName = editingClient?.name;

      if (!name) {
        return;
      }

      const client = {
        name,
        messageName: String(form.get("messageName") ?? "").trim(),
        phone: String(form.get("phone") ?? "").trim(),
        email: String(form.get("email") ?? "").trim(),
        birthday: String(form.get("birthday") ?? "").trim(),
        instagram: String(form.get("instagram") ?? "").trim(),
        telegram: String(form.get("telegram") ?? "").trim(),
        source: form.get("source"),
        messageLanguage: form.get("messageLanguage") || "Польский",
        preference: form.get("preference"),
        status: form.get("status") || "Активный",
        tags: String(form.get("tags") ?? "").trim(),
        note: String(form.get("note") ?? "").trim(),
      };

      if (editingClient?.id) {
        client.id = editingClient.id;
      }

      let savedClient = client;
      try {
        const response = editingClient?.id
          ? await updateClient(editingClient.id, client)
          : await createClient(client);
        savedClient = response?.data ?? client;
      } catch (error) {
        pushNotification({
          title: editingClient ? "Клиент не обновлен" : "Клиент не добавлен",
          message: error?.message || "Не удалось сохранить клиента в backend",
          persist: false,
        });
        return;
      }

      setClientProfiles((current) =>
        editingClient
          ? current.map((item) => (item.id === savedClient.id ? savedClient : item))
          : [savedClient, ...current],
      );

      if (previousName && previousName !== savedClient.name) {
        const previousClient = {...savedClient, name: previousName};

        setVisits((current) =>
          remapClientRecords(current, clientProfiles, previousClient, savedClient),
        );
        setClientPackages((current) =>
          remapClientRecords(current, clientProfiles, previousClient, savedClient),
        );
        setCertificates((current) =>
          current.map((certificate) => {
            if (
              !matchesCertificateClient(certificate, clientProfiles, previousClient)
            ) {
              return certificate;
            }

            const nextCertificate = {...certificate};

            if (
              matchesClientRecord(
                {client: certificate.client, clientId: certificate.clientId},
                clientProfiles,
                previousClient,
              )
            ) {
              nextCertificate.client = savedClient.name;
              nextCertificate.clientId = savedClient.id;
            }

            if (
              certificate.recipient &&
              matchesClientRecord(
                {
                  client: certificate.recipient,
                  clientId: certificate.recipientId,
                },
                clientProfiles,
                previousClient,
              )
            ) {
              nextCertificate.recipient = savedClient.name;
              nextCertificate.recipientId = savedClient.id;
            }

            return nextCertificate;
          }),
        );
        setCalendarEntries((current) =>
          remapClientRecords(current, clientProfiles, previousClient, savedClient, {
            visitOnly: true,
          }),
        );
      }

      setClientModalOpen(false);
      setEditingClient(null);
      pushNotification({
        title: editingClient ? "Клиент обновлен" : "Клиент добавлен",
        message: `${savedClient.name} сохранен в базе клиентов`,
      });
    },
    [
      clientProfiles,
      editingClient,
      pushNotification,
      setCalendarEntries,
      setClientModalOpen,
      setClientPackages,
      setClientProfiles,
      setCertificates,
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
    async (client) => {
      try {
        await deleteClient(client.id);
      } catch (error) {
        pushNotification({
          title: "Клиент не удален",
          message: error?.message || "Не удалось удалить клиента в backend",
          persist: false,
        });
        return;
      }

      setClientProfiles((current) => current.filter((item) => item.id !== client.id));
      setClientPackages((current) =>
        current.filter(
          (packageItem) => !matchesClientRecord(packageItem, clientProfiles, client),
        ),
      );
      setCertificates((current) =>
        current.filter(
          (certificate) =>
            !matchesCertificateClient(certificate, clientProfiles, client),
        ),
      );
      pushNotification({
        title: "Клиент удален",
        message: `${client.name} удален из базы клиентов`,
      });
    },
    [clientProfiles, pushNotification, setCertificates, setClientPackages, setClientProfiles],
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
    async (name) => {
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

      try {
        const response = await createClient({
          name: trimmedName,
          phone: "",
          email: "",
          birthday: "",
          instagram: "",
          telegram: "",
          source: "Визит",
          messageLanguage: "Польский",
          preference: "Любой мастер",
          status: "Новый",
          tags: "",
          note: "",
        });
        const savedClient = response?.data;
        if (savedClient) {
          setClientProfiles((current) => [savedClient, ...current]);
        }
      } catch (error) {
        pushNotification({
          title: "Клиент не добавлен",
          message: error?.message || "Не удалось сохранить клиента в backend",
          persist: false,
        });
        return;
      }

      pushNotification({
        title: "Клиент добавлен",
        message: `${trimmedName} теперь в базе клиентов`,
      });
    },
    [clientProfiles, pushNotification, setClientProfiles],
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
    async (event) => {
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
        ...(editingClientPackage?.id ? {id: editingClientPackage.id} : {}),
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
      let savedClientPackage;

      try {
        const response = editingClientPackage
          ? await updateClientPackage(editingClientPackage.id, clientPackage)
          : await createClientPackage(clientPackage);
        savedClientPackage = response?.data ?? clientPackage;
      } catch (error) {
        pushNotification({
          title: editingClientPackage ? "Остаток не обновлен" : "Пакет не продан",
          message: error?.message || "Backend не принял пакет клиента",
          persist: false,
        });
        return;
      }

      setClientPackages((current) =>
        editingClientPackage
          ? current.map((item) =>
              item.id === savedClientPackage.id ? savedClientPackage : item,
            )
          : [savedClientPackage, ...current],
      );
      setClientPackageModalOpen(false);
      setEditingClientPackage(null);
      pushNotification({
        title: editingClientPackage ? "Остаток обновлен" : "Пакет продан",
        message: `${savedClientPackage.client}: использовано ${getPackageProgressLabel(savedClientPackage)}`,
      });
    },
    [
      clientProfiles,
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
    async (packageItem) => {
      try {
        await deleteClientPackage(packageItem.id);
      } catch (error) {
        pushNotification({
          title: "Пакет клиента не удален",
          message: error?.message || "Backend не удалил пакет клиента",
          persist: false,
        });
        return;
      }

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

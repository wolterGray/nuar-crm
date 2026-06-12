import {useCallback} from "react";
import {attachClientLink} from "../utils/clientLinks.js";
import {
  computeCertificateExpiryDate,
  generateCertificateCode,
  syncCertificateStatus,
} from "../utils/certificates.js";
import {toDisplayDate} from "../utils/formatters.jsx";
import {toVisitNumber} from "../utils/visits.jsx";

export function useCertificateHandlers({
  certificates,
  clientProfiles,
  createLocalId,
  editingCertificate,
  pushNotification,
  requestEntityDelete,
  setCertificateModalOpen,
  setCertificates,
  setEditingCertificate,
  setVisits,
}) {
  const openCreateCertificate = useCallback(() => {
    setEditingCertificate(null);
    setCertificateModalOpen(true);
  }, [setCertificateModalOpen, setEditingCertificate]);

  const openEditCertificate = useCallback(
    (certificate) => {
      setEditingCertificate(certificate);
      setCertificateModalOpen(true);
    },
    [setCertificateModalOpen, setEditingCertificate],
  );

  const handleCertificateSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const nominal = toVisitNumber(form.get("nominal"));
      const remainingBalance = editingCertificate
        ? toVisitNumber(form.get("remainingBalance"))
        : nominal;
      const validityDays = Number(form.get("validityDays")) || 365;
      const purchaseDate = toDisplayDate(form.get("purchaseDate"));
      const buyer = attachClientLink(clientProfiles, {
        client: String(form.get("client") ?? "").trim(),
      });
      const recipientName = String(form.get("recipient") ?? "").trim();
      const recipient = recipientName
        ? attachClientLink(clientProfiles, {client: recipientName})
        : buyer;
      const code =
        String(form.get("code") ?? "").trim() ||
        editingCertificate?.code ||
        generateCertificateCode(certificates.map((item) => item.code));

      if (!nominal || !buyer.client) {
        return;
      }

      const certificate = syncCertificateStatus({
        id: editingCertificate?.id ?? createLocalId(),
        code,
        client: buyer.client,
        clientId: buyer.clientId || "",
        recipient: recipient.client,
        recipientId: recipient.clientId || "",
        nominal,
        remainingBalance: Math.min(remainingBalance, nominal),
        purchaseDate,
        expiryDate:
          toDisplayDate(form.get("expiryDate")) ||
          computeCertificateExpiryDate(purchaseDate, validityDays),
        payment: String(form.get("payment") ?? "Не указано"),
        master: String(form.get("master") ?? "").trim(),
        status: String(form.get("status") ?? "Активен"),
        note: String(form.get("note") ?? "").trim(),
        saleVisitId: editingCertificate?.saleVisitId ?? "",
      });

      if (editingCertificate) {
        setCertificates((current) =>
          current.map((item) =>
            item.id === certificate.id ? certificate : item,
          ),
        );
        pushNotification({
          title: "Сертификат обновлён",
          message: `${certificate.code} · ${certificate.client}`,
        });
      } else {
        const saleVisitId = createLocalId();
        const saleVisit = attachClientLink(clientProfiles, {
          id: saleVisitId,
          amount: 0,
          client: certificate.client,
          clientId: certificate.clientId,
          commission: 0,
          commissionType: "Без комиссии",
          date: certificate.purchaseDate,
          debt: 0,
          discount: 0,
          duration: "",
          extra: nominal,
          master: certificate.master,
          note: certificate.note,
          packageName: "",
          packageSessionsUsed: 0,
          packageUsageId: "",
          payment: certificate.payment,
          recordType: "operation",
          service: "Продажа сертификата",
          tip: 0,
          certificateId: certificate.id,
        });

        setCertificates((current) => [
          {...certificate, saleVisitId},
          ...current,
        ]);
        setVisits((current) => [saleVisit, ...current]);
        pushNotification({
          title: "Сертификат продан",
          message: `${certificate.code} · ${nominal} zł`,
        });
      }

      setCertificateModalOpen(false);
      setEditingCertificate(null);
    },
    [
      certificates,
      clientProfiles,
      createLocalId,
      editingCertificate,
      pushNotification,
      setCertificateModalOpen,
      setCertificates,
      setEditingCertificate,
      setVisits,
    ],
  );

  const requestDeleteCertificate = useCallback(
    (certificate) => {
      requestEntityDelete("certificate", certificate);
    },
    [requestEntityDelete],
  );

  const performDeleteCertificate = useCallback(
    (certificate) => {
      setCertificates((current) =>
        current.filter((item) => item.id !== certificate.id),
      );
      pushNotification({
        title: "Сертификат удалён",
        message: `${certificate.code} · ${certificate.client}`,
        undoAction: {
          type: "restore-certificate",
          payload: certificate,
        },
      });
    },
    [pushNotification, setCertificates],
  );

  return {
    handleCertificateSubmit,
    openCreateCertificate,
    openEditCertificate,
    performDeleteCertificate,
    requestDeleteCertificate,
  };
}

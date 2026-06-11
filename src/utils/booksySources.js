export const applyBooksySources = (clients, visits) => {
  const booksyClients = new Set(
    visits
      .filter((visit) => visit.commissionType === "Booksy 45%")
      .map((visit) => visit.client),
  );

  return clients.map((client) =>
    booksyClients.has(client.name) && client.source !== "Booksy"
      ? {...client, source: "Booksy"}
      : client,
  );
};

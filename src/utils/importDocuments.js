export const removeImportDocumentsByIds = (documents = [], ids = []) => {
  const idSet = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));

  if (idSet.size === 0) {
    return documents;
  }

  return documents.filter((document) => !idSet.has(document.id));
};

export const removeImportedMailIds = (mailIds = [], ids = []) => {
  const idSet = new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean));

  if (idSet.size === 0) {
    return mailIds;
  }

  return mailIds.filter((mailId) => !idSet.has(mailId));
};

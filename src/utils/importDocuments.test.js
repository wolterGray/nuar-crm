import {describe, expect, it} from "vitest";
import {removeImportedMailIds, removeImportDocumentsByIds} from "./importDocuments.js";

describe("importDocuments", () => {
  it("removes documents and related mail ids", () => {
    const documents = [
      {id: "a", type: "document"},
      {id: "b", type: "document"},
    ];
    const mailIds = ["a", "b", "c"];

    expect(removeImportDocumentsByIds(documents, "a")).toEqual([{id: "b", type: "document"}]);
    expect(removeImportedMailIds(mailIds, ["a", "b"])).toEqual(["c"]);
  });
});

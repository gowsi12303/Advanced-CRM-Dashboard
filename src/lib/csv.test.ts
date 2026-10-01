import { describe, expect, it } from "vitest";

import { escapeCsvCell, toCsv } from "./csv";

describe("escapeCsvCell", () => {
  it("leaves plain text and numbers alone", () => {
    expect(escapeCsvCell("Acme Ltd")).toBe("Acme Ltd");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(-3)).toBe("-3");
  });

  it("writes missing values as empty cells", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell("")).toBe("");
  });

  it("quotes cells containing commas", () => {
    expect(escapeCsvCell("Smith, Jones & Co")).toBe('"Smith, Jones & Co"');
  });

  it("quotes cells containing quotes and doubles them", () => {
    expect(escapeCsvCell('Dwayne "The Rock" Johnson')).toBe(
      '"Dwayne ""The Rock"" Johnson"',
    );
  });

  it("quotes cells containing line breaks", () => {
    expect(escapeCsvCell("line one\nline two")).toBe('"line one\nline two"');
    expect(escapeCsvCell("line one\r\nline two")).toBe('"line one\r\nline two"');
  });

  it("neutralises text a spreadsheet would run as a formula", () => {
    expect(escapeCsvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(escapeCsvCell("+1 (415) 555-0100")).toBe("'+1 (415) 555-0100");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@handle")).toBe("'@handle");
    expect(escapeCsvCell('=HYPERLINK("http://x","y")')).toBe(
      '"\'=HYPERLINK(""http://x"",""y"")"',
    );
    // Only at the start of the cell.
    expect(escapeCsvCell("a=b")).toBe("a=b");
    expect(escapeCsvCell("name@example.com")).toBe("name@example.com");
  });
});

describe("toCsv", () => {
  it("writes a header row and CRLF-separated rows", () => {
    expect(
      toCsv(
        ["Name", "Company"],
        [
          ["Ada", "Analytical Engines"],
          ["Grace", "Navy"],
        ],
      ),
    ).toBe("Name,Company\r\nAda,Analytical Engines\r\nGrace,Navy");
  });

  it("writes only the header for no rows", () => {
    expect(toCsv(["Name", "Company"], [])).toBe("Name,Company");
  });

  it("escapes every cell, including headers", () => {
    expect(toCsv(["Name, full"], [['He said "hi"'], [null], ["a\nb"]])).toBe(
      '"Name, full"\r\n"He said ""hi"""\r\n\r\n"a\nb"',
    );
  });
});

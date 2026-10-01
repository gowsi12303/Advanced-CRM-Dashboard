import { describe, expect, it } from "vitest";

import { toDateTimeLocalValue, toLocalDateOnly } from "@/lib/format";

import type { Customer } from "../types";
import {
  CUSTOMER_CSV_HEADERS,
  customersCsvFilename,
  customersToCsv,
} from "./export";

const BASE: Customer = {
  id: "cus_1",
  name: "Priya Patel",
  email: "priya.patel@vela.example",
  phone: "+1 (415) 555-0100",
  company: "Vela Software",
  jobTitle: "Head of Operations",
  status: "active",
  pipelineRank: 1000,
  createdAt: "2026-02-03T12:00:00.000Z",
  updatedAt: "2026-02-03T12:00:00.000Z",
  lastContactedAt: "2026-03-04T12:30:00.000Z",
  lastContactMethod: "phone",
};

describe("customersToCsv", () => {
  it("starts with the header row", () => {
    expect(CUSTOMER_CSV_HEADERS).toEqual([
      "Name",
      "Email",
      "Phone",
      "Company",
      "Job title",
      "Status",
      "Last contact",
      "Last contact method",
      "Created",
    ]);
    expect(customersToCsv([])).toBe(
      "Name,Email,Phone,Company,Job title,Status,Last contact,Last contact method,Created",
    );
  });

  it("writes one row per customer with readable values", () => {
    const lines = customersToCsv([BASE]).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      [
        "Priya Patel",
        "priya.patel@vela.example",
        "'+1 (415) 555-0100",
        "Vela Software",
        "Head of Operations",
        "Active",
        toDateTimeLocalValue(new Date(BASE.lastContactedAt ?? "")).replace("T", " "),
        "Phone call",
        toLocalDateOnly(new Date(BASE.createdAt)),
      ].join(","),
    );
  });

  it("leaves last-contact cells empty for a customer never contacted", () => {
    const row = customersToCsv([
      { ...BASE, lastContactedAt: null, lastContactMethod: null, jobTitle: "" },
    ]).split("\r\n")[1];
    expect(row.split(",").slice(4, 8)).toEqual(["", "Active", "", ""]);
  });

  it("escapes commas, quotes and line breaks in customer data", () => {
    const csv = customersToCsv([
      {
        ...BASE,
        name: 'Dwayne "Rock" Johnson',
        company: "Smith, Jones & Co",
        jobTitle: "Line one\nLine two",
      },
    ]);
    expect(csv).toContain('"Dwayne ""Rock"" Johnson"');
    expect(csv).toContain('"Smith, Jones & Co"');
    expect(csv).toContain('"Line one\nLine two"');
  });
});

describe("customersCsvFilename", () => {
  it("includes the local date, and says when the list was narrowed", () => {
    const now = new Date(2026, 9, 1, 15);
    expect(customersCsvFilename(now, false)).toBe("customers-2026-10-01.csv");
    expect(customersCsvFilename(now, true)).toBe("customers-filtered-2026-10-01.csv");
  });
});

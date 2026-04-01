import { describe, expect, it } from "vitest";
import {
  escapeIcsText,
  getIcsProp,
  hashText,
  normalizeIcs,
  parseIcsDate,
  parseIcsEvents,
  serializeEventsToIcs,
  toIcsDate,
  toIcsDateTimeUtc,
} from "../../modules/ics-utils.js";

describe("modules/ics-utils", () => {
  it("normalizes ICS text and reads properties", () => {
    const raw = "BEGIN:VCALENDAR\r\nSUMMARY: A\r\n folded\r\nEND:VCALENDAR";
    const normalized = normalizeIcs(raw);

    expect(normalized).toContain("SUMMARY: Afolded");

    const lines = ["DTSTART;VALUE=DATE:20260312", "SUMMARY: Focus"];
    expect(getIcsProp(lines, "DTSTART")).toBe("20260312");
    expect(getIcsProp(lines, "SUMMARY")).toBe("Focus");
    expect(getIcsProp(lines, "MISSING")).toBe("");
  });

  it("parses ICS dates and rejects invalid input", () => {
    expect(parseIcsDate("20260312")).toBe("2026-03-12");
    expect(parseIcsDate("20260312T000000Z")).toBe("2026-03-12");
    expect(parseIcsDate("not-a-date")).toBeNull();
    expect(parseIcsDate("")).toBeNull();
  });

  it("parses, deduplicates and serializes ICS events", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:abc",
      "DTSTART;VALUE=DATE:20260320",
      "SUMMARY:Exam",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:abc",
      "DTSTART;VALUE=DATE:20260320",
      "SUMMARY:Exam",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:def",
      "DTSTART:20260321T120000Z",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");

    const parsed = parseIcsEvents(ics);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ externalUid: "abc", date: "2026-03-20", summary: "Exam" });
    expect(parsed[1]).toMatchObject({ externalUid: "def", summary: "Importierter Termin" });

    const exported = serializeEventsToIcs([
      { uid: "u1", date: "2026-03-22", summary: "A, B", description: "Line1\nLine2" },
    ]);

    expect(exported).toContain("BEGIN:VCALENDAR");
    expect(exported).toContain("UID:u1");
    expect(exported).toContain("SUMMARY:A\\, B");
    expect(exported).toContain("DESCRIPTION:Line1\\nLine2");
    expect(exported).toContain("DTSTART;VALUE=DATE:20260322");
    expect(exported).toContain("DTEND;VALUE=DATE:20260323");

    expect(escapeIcsText("A;B,C\\D\nE")).toBe("A\\;B\\,C\\\\D\\nE");
    expect(toIcsDate("2026-03-09T08:00:00Z")).toBe("20260309");
    expect(toIcsDateTimeUtc("2026-03-09T08:00:00Z")).toMatch(/^20260309T080000Z$/);
    expect(hashText("same")).toBe(hashText("same"));
    expect(hashText("same")).not.toBe(hashText("other"));
  });
});

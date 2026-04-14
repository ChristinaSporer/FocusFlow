import { describe, expect, it, vi } from "vitest";

import { uid } from "../../modules/app-utils.js";

describe("modules/app-utils", () => {
  describe("uid", () => {
    it("gibt eine nicht-leere Zeichenkette zurueck", () => {
      const id = uid();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("gibt unterschiedliche IDs bei mehrfachem Aufruf zurueck", () => {
      const a = uid();
      const b = uid();
      expect(a).not.toBe(b);
    });

    it("nutzt Fallback wenn crypto.randomUUID nicht verfuegbar ist", () => {
      const originalCrypto = globalThis.crypto;
      vi.stubGlobal("crypto", undefined);

      const id = uid();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      // Fallback-Format: "<timestamp>-<random>"
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);

      vi.stubGlobal("crypto", originalCrypto);
    });

    it("nutzt Fallback wenn crypto vorhanden aber randomUUID fehlt", () => {
      vi.stubGlobal("crypto", {});

      const id = uid();
      expect(typeof id).toBe("string");
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);

      vi.unstubAllGlobals();
    });
  });
});

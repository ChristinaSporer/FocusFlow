const fs = require("node:fs");
const path = require("node:path");

function loadDomWithoutScript() {
  const htmlPath = path.resolve(__dirname, "../../index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : "";
  document.body.innerHTML = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, "");
}

function createMainCardBreakpointMock(initialDesktop) {
  const listeners = new Set();
  const mediaQuery = {
    matches: Boolean(initialDesktop),
    media: "(min-width: 1200px)",
    onchange: null,
    addEventListener(eventName, listener) {
      if (eventName === "change") listeners.add(listener);
    },
    removeEventListener(eventName, listener) {
      if (eventName === "change") listeners.delete(listener);
    },
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
  };

  const matchMedia = vi.fn((query) => {
    if (query === mediaQuery.media) return mediaQuery;
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    };
  });

  function update(nextDesktop) {
    mediaQuery.matches = Boolean(nextDesktop);
    const event = { matches: mediaQuery.matches, media: mediaQuery.media };
    listeners.forEach((listener) => listener(event));
    if (typeof mediaQuery.onchange === "function") {
      mediaQuery.onchange(event);
    }
  }

  return { matchMedia, update };
}

function createLegacyMainCardBreakpointMock(initialDesktop) {
  const listeners = new Set();
  const mediaQuery = {
    matches: Boolean(initialDesktop),
    media: "(min-width: 1200px)",
    onchange: null,
    addListener(listener) {
      listeners.add(listener);
    },
    removeListener(listener) {
      listeners.delete(listener);
    },
  };

  const matchMedia = vi.fn((query) => {
    if (query === mediaQuery.media) return mediaQuery;
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
    };
  });

  function update(nextDesktop) {
    mediaQuery.matches = Boolean(nextDesktop);
    const event = { matches: mediaQuery.matches, media: mediaQuery.media };
    listeners.forEach((listener) => listener(event));
    if (typeof mediaQuery.onchange === "function") {
      mediaQuery.onchange(event);
    }
  }

  return { matchMedia, update };
}

describe("App-UI-Integration (jsdom)", () => {
  let appModule;
  let breakpointController;

  async function bootApp({
    notification,
    storedState,
    viewport = "desktop",
    matchMediaMode = "modern",
  } = {}) {
    localStorage.clear();
    if (storedState) {
      localStorage.setItem("focusflow-v1", JSON.stringify(storedState));
    }

    loadDomWithoutScript();

    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);

    if (notification === null) {
      Reflect.deleteProperty(window, "Notification");
    } else if (notification) {
      const notificationCtor = vi.fn();
      notificationCtor.permission = notification.permission ?? "default";
      notificationCtor.requestPermission =
        notification.requestPermission ?? vi.fn(async () => notificationCtor.permission);
      window.Notification = notificationCtor;
    } else {
      window.Notification = {
        permission: "denied",
        requestPermission: vi.fn(async () => "denied"),
      };
    }

    breakpointController = null;
    if (matchMediaMode === "none") {
      Reflect.deleteProperty(window, "matchMedia");
    } else {
      breakpointController =
        matchMediaMode === "legacy"
          ? createLegacyMainCardBreakpointMock(viewport !== "mobile")
          : createMainCardBreakpointMock(viewport !== "mobile");
      window.matchMedia = breakpointController.matchMedia;
    }

    vi.resetModules();
    const module = await import("../../app.js");
    module.bootstrap();
    return module;
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));
    appModule = await bootApp();
  });

  afterEach(() => {
    if (appModule?.shutdown) {
      appModule.shutdown();
    }

    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("legt ein Ziel an und speichert es in localStorage", () => {
    const title = "SE Lernziel";
    const date = "2026-03-15";
    const description = "Architektur, Tests und Review abschließen";

    document.getElementById("goal-title").value = title;
    document.getElementById("goal-date").value = date;
    document.getElementById("goal-description").value = description;

    const form = document.getElementById("goal-form");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.getElementById("goal-list").textContent).toContain(title);

    const raw = localStorage.getItem("focusflow-v1");
    const parsed = JSON.parse(raw);
    expect(parsed.goals).toHaveLength(1);
    expect(parsed.goals[0].title).toBe(title);
    expect(parsed.goals[0].targetDate).toBe(date);
    expect(parsed.goals[0].description).toBe(description);
    expect(document.getElementById("goal-list").textContent).toContain(description);
    expect(document.querySelector("#goal-list [data-goal-toggle]")).not.toBeNull();
  });

  it("bearbeitet ein bestehendes Ziel inklusive Titel, Datum und Beschreibung", () => {
    document.getElementById("goal-title").value = "Altes Ziel";
    document.getElementById("goal-date").value = "2026-03-15";
    document.getElementById("goal-description").value = "Erste Version";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.querySelector("#goal-list .btn-outline-secondary")?.click();

    expect(document.getElementById("goal-title").value).toBe("Altes Ziel");
    expect(document.getElementById("goal-submit").textContent).toContain("speichern");

    document.getElementById("goal-title").value = "Aktualisiertes Ziel";
    document.getElementById("goal-date").value = "2026-03-20";
    document.getElementById("goal-description").value = "Überarbeitete Beschreibung";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const raw = localStorage.getItem("focusflow-v1");
    const parsed = JSON.parse(raw);
    expect(parsed.goals).toHaveLength(1);
    expect(parsed.goals[0].title).toBe("Aktualisiertes Ziel");
    expect(parsed.goals[0].targetDate).toBe("2026-03-20");
    expect(parsed.goals[0].description).toBe("Überarbeitete Beschreibung");
    expect(document.getElementById("goal-list").textContent).toContain(
      "Überarbeitete Beschreibung"
    );
    expect(document.getElementById("goal-edit-id").value).toBe("");
  });

  it("legt Meilensteine fuer ein Ziel an und markiert sie als erledigt", () => {
    document.getElementById("goal-title").value = "Ziel mit Zwischenzielen";
    document.getElementById("goal-date").value = "2026-03-22";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Erstes Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.getElementById("goal-list").textContent).toContain("Erstes Zwischenziel");

    const milestoneCheckbox = document.querySelector("#goal-list [data-goal-milestone-toggle]");
    milestoneCheckbox.checked = true;
    milestoneCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    const raw = localStorage.getItem("focusflow-v1");
    const parsed = JSON.parse(raw);
    expect(parsed.goals[0].milestones).toHaveLength(1);
    expect(parsed.goals[0].milestones[0].title).toBe("Erstes Zwischenziel");
    expect(parsed.goals[0].milestones[0].done).toBe(true);
    expect(document.getElementById("goal-list").textContent).toContain(
      "Zwischenziele: 1/1 erledigt"
    );
  });

  it("schaltet offene Zieldetails zwischen ausgeklappt und eingeklappt um", () => {
    document.getElementById("goal-title").value = "Klappbares Ziel";
    document.getElementById("goal-date").value = "2026-03-22";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Klappbares Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const toggleButton = document.querySelector("#goal-list [data-goal-collapse-toggle]");
    const goalBody = document.querySelector("#goal-list [data-goal-body]");
    expect(toggleButton).toBeTruthy();
    expect(goalBody).toBeTruthy();
    expect(goalBody.classList.contains("d-none")).toBe(false);

    toggleButton.click();
    expect(goalBody.classList.contains("d-none")).toBe(true);
    expect(toggleButton.getAttribute("aria-label")).toBe("Ausklappen");

    toggleButton.click();
    expect(goalBody.classList.contains("d-none")).toBe(false);
    expect(toggleButton.getAttribute("aria-label")).toBe("Einklappen");
  });

  it("rendert auf Desktop standardmaessig alle Hauptkarten ausgeklappt", () => {
    const cardBodies = Array.from(document.querySelectorAll("[data-main-card-body]"));
    expect(cardBodies.length).toBeGreaterThan(0);
    expect(cardBodies.every((cardBody) => !cardBody.classList.contains("d-none"))).toBe(true);
  });

  it("rendert auf Mobile standardmaessig alle Hauptkarten eingeklappt", async () => {
    appModule.shutdown();

    appModule = await bootApp({ viewport: "mobile" });

    const cardBodies = Array.from(document.querySelectorAll("[data-main-card-body]"));
    expect(cardBodies.length).toBeGreaterThan(0);
    expect(cardBodies.every((cardBody) => cardBody.classList.contains("d-none"))).toBe(true);
  });

  it("wendet responsive Standardwerte bei Breakpoint-Wechseln erneut an", () => {
    const goalCardToggle = document.querySelector('[data-main-card-toggle="goals"]');
    const goalCardBody = document.querySelector('[data-main-card-body="goals"]');
    expect(goalCardToggle).toBeTruthy();
    expect(goalCardBody).toBeTruthy();
    expect(goalCardBody.classList.contains("d-none")).toBe(false);

    goalCardToggle.click();
    expect(goalCardBody.classList.contains("d-none")).toBe(true);

    breakpointController.update(false);
    const cardBodiesAfterMobile = Array.from(document.querySelectorAll("[data-main-card-body]"));
    expect(cardBodiesAfterMobile.every((cardBody) => cardBody.classList.contains("d-none"))).toBe(
      true
    );

    breakpointController.update(true);
    const cardBodiesAfterDesktop = Array.from(document.querySelectorAll("[data-main-card-body]"));
    expect(cardBodiesAfterDesktop.every((cardBody) => !cardBody.classList.contains("d-none"))).toBe(
      true
    );
  });

  it("bearbeitet und loescht einen Meilenstein eines Ziels", () => {
    document.getElementById("goal-title").value = "Ziel mit editierbarem Zwischenziel";
    document.getElementById("goal-date").value = "2026-03-22";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Altes Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.querySelector("#goal-list [data-goal-milestone-edit]")?.click();
    const inlineEditInput = document.querySelector(
      "#goal-list [data-goal-milestone-inline-edit] input"
    );
    inlineEditInput.value = "Neues Zwischenziel";
    inlineEditInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.getElementById("goal-list").textContent).toContain("Neues Zwischenziel");

    document.querySelector("#goal-list [data-goal-milestone-delete]")?.click();

    const raw = localStorage.getItem("focusflow-v1");
    const parsed = JSON.parse(raw);
    expect(parsed.goals[0].milestones).toHaveLength(0);
    expect(document.getElementById("goal-list").textContent).toContain("Noch keine Zwischenziele");
  });

  it("erstellt eine Detailplanung innerhalb eines monatlichen Grobplanungsblocks und rendert sie in der Kalenderansicht", () => {
    document.getElementById("goal-title").value = "SE Ziel";
    document.getElementById("goal-date").value = "2026-03-20";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Architektur vertiefen";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const goalId = Array.from(document.getElementById("rough-goal").options)[1].value;
    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = goalId;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailForm = document.querySelector("[data-detail-block-form]");
    const milestoneSelect = detailForm.querySelector("select");
    const startInput = detailForm.querySelector("[data-detail-start]");
    const endInput = detailForm.querySelector("[data-detail-end]");
    const topicInput = detailForm.querySelector('input[type="text"]');
    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    startInput.value = "09:00";
    endInput.value = "10:30";
    topicInput.value = "Architektur";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("tab-calendar").click();

    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(true);
    expect(document.querySelector(".lz-calendar-event.lz-source-detail")?.textContent).toContain(
      "Architektur vertiefen"
    );
  });

  it("wechselt zum Kalender-Ansichts-Tab", () => {
    document.getElementById("tab-calendar").click();

    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(true);
  });

  it("laedt Demodaten", () => {
    document.getElementById("menu-demo").click();

    expect(document.getElementById("goal-list").textContent).toContain(
      "Modul Software Engineering abschließen"
    );
  });

  it("normalisiert einen ungueltigen Theme-Modus beim Bootstrap", async () => {
    appModule.shutdown();

    appModule = await bootApp({
      notification: {
        permission: "granted",
        requestPermission: vi.fn(async () => "granted"),
      },
      storedState: {
        settings: {
          themeMode: "invalid-theme",
          activeView: "list",
          calendarMonth: null,
        },
      },
    });

    const persisted = JSON.parse(localStorage.getItem("focusflow-v1"));
    expect(persisted.settings.themeMode).toBe("auto");
  });

  it("verwendet den aktuellen Monat als Fallback, wenn die Monatsauswahl fehlt", () => {
    document.getElementById("month-select").value = "2026-04";
    document.getElementById("month-select").dispatchEvent(new Event("change", { bubbles: true }));

    document.getElementById("goal-title").value = "April Goal";
    document.getElementById("goal-start-date").value = "2026-04-20";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "April Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W16";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailForm = document.querySelector("[data-detail-block-form]");
    const milestoneSelect = detailForm.querySelector("select");
    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "09:00";
    detailForm.querySelector("[data-detail-end]").value = "09:45";
    detailForm.querySelector('input[type="text"]').value = "April Thema";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.getElementById("detail-list").textContent).toContain("April Zwischenziel");

    document.getElementById("month-select").remove();
    document.getElementById("tab-calendar").click();

    expect(document.getElementById("detail-list").textContent).not.toContain(
      "45 Min für April Zwischenziel"
    );
    expect(document.getElementById("detail-list").textContent).toContain("Weitere Detailplanung");
  });

  it("rendert monatliche Grobplanungsbloecke mit auswaehlbaren Meilensteinen", () => {
    document.getElementById("goal-title").value = "Block Goal";
    document.getElementById("goal-start-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Erstes Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneCheckbox = document.querySelector("#goal-list [data-goal-milestone-toggle]");
    milestoneCheckbox.checked = true;
    milestoneCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "3";
    document.getElementById("rough-note").value = "Sprintplanung";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.getElementById("detail-list").textContent).toContain(
      "3 h geplant für Block Goal"
    );
    expect(document.getElementById("detail-list").textContent).toContain("Verteilt: 0 von 180 Min");
    const blockForm = document.querySelector("[data-detail-block-form]");
    expect(blockForm).toBeTruthy();
    expect(blockForm.querySelector("select").textContent).toContain(
      "Erstes Zwischenziel (erledigt)"
    );
  });

  it("schaltet Detailbloecke der Grobplanung zwischen ausgeklappt und eingeklappt um", () => {
    document.getElementById("goal-title").value = "Klappbar Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const toggleButton = document.querySelector("[data-detail-block-toggle]");
    const blockBody = document.querySelector("[data-detail-block-body]");
    expect(toggleButton).toBeTruthy();
    expect(blockBody).toBeTruthy();
    expect(blockBody.classList.contains("d-none")).toBe(false);

    toggleButton.click();
    expect(blockBody.classList.contains("d-none")).toBe(true);
    expect(toggleButton.getAttribute("aria-label")).toBe("Ausklappen");

    toggleButton.click();
    expect(blockBody.classList.contains("d-none")).toBe(false);
    expect(toggleButton.getAttribute("aria-label")).toBe("Einklappen");
  });

  it("klappt alle Detailbloecke der Grobplanung ein und aus", () => {
    document.getElementById("goal-title").value = "Global Toggle Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W12";
    document.getElementById("rough-hours").value = "3";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const collapseAllButton = document.getElementById("detail-collapse-all");
    const bodies = Array.from(document.querySelectorAll("[data-detail-block-body]"));
    const additionalBody = document.querySelector("[data-detail-additional-body]");
    expect(collapseAllButton).toBeTruthy();
    expect(bodies).toHaveLength(2);
    expect(additionalBody).toBeTruthy();

    // all expanded by default → clicking collapses all
    collapseAllButton.click();
    expect(bodies.every((body) => body.classList.contains("d-none"))).toBe(true);
    expect(additionalBody.classList.contains("d-none")).toBe(true);

    // all collapsed → clicking expands all
    collapseAllButton.click();
    expect(bodies.every((body) => !body.classList.contains("d-none"))).toBe(true);
    expect(additionalBody.classList.contains("d-none")).toBe(false);
  });

  it("laesst andere Grobplanungsbloecke eingeklappt, nachdem eine Detail-Checkbox umgeschaltet wurde", () => {
    document.getElementById("goal-title").value = "Persist Collapse Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Persist Collapse Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W12";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const firstForm = document.querySelector("[data-detail-block-form]");
    const milestoneSelect = firstForm.querySelector("select");
    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    firstForm.querySelector("[data-detail-start]").value = "09:00";
    firstForm.querySelector("[data-detail-end]").value = "09:30";
    firstForm.querySelector('input[type="text"]').value = "Eintrag fuer Checkbox";
    firstForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    let toggleButtons = Array.from(document.querySelectorAll("[data-detail-block-toggle]"));
    let bodies = Array.from(document.querySelectorAll("[data-detail-block-body]"));
    toggleButtons[1].click();
    expect(bodies[1].classList.contains("d-none")).toBe(true);

    bodies = Array.from(document.querySelectorAll("[data-detail-block-body]"));
    expect(bodies[1].classList.contains("d-none")).toBe(true);
  });

  it("schaltet den zusaetzlichen Detailplanungsblock zwischen ausgeklappt und eingeklappt um", () => {
    const additionalToggle = document.querySelector("[data-detail-additional-toggle]");
    const additionalBody = document.querySelector("[data-detail-additional-body]");

    expect(additionalToggle).toBeTruthy();
    expect(additionalBody).toBeTruthy();
    expect(additionalBody.classList.contains("d-none")).toBe(false);

    additionalToggle.click();
    expect(additionalBody.classList.contains("d-none")).toBe(true);
    expect(additionalToggle.getAttribute("aria-label")).toBe("Ausklappen");

    additionalToggle.click();
    expect(additionalBody.classList.contains("d-none")).toBe(false);
    expect(additionalToggle.getAttribute("aria-label")).toBe("Einklappen");
  });

  it("registriert beim zweiten Bootstrap keine doppelten Handler", () => {
    appModule.bootstrap();

    document.getElementById("goal-title").value = "Einmaliges Ziel";
    document.getElementById("goal-date").value = "2026-03-20";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    expect(parsed.goals).toHaveLength(1);
    expect(parsed.goals[0].title).toBe("Einmaliges Ziel");
  });

  it("fuellt das Ziel-Dropdown mit offenen Zielen sortiert nach targetDate", () => {
    document.getElementById("goal-title").value = "First Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("goal-title").value = "Second Goal";
    document.getElementById("goal-date").value = "2026-03-20";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const dropdown = document.getElementById("rough-goal");
    const options = Array.from(dropdown.options);
    expect(options).toHaveLength(3);
    expect(options[0].value).toBe("");
    expect(options[0].textContent).toBe("Kein Ziel zugeordnet");
    expect(options[1].textContent).toBe("Second Goal");
    expect(options[2].textContent).toBe("First Goal");
  });

  it("legt eine Grobplanung mit Zielzuordnung an und zeigt den Zieltitel an", () => {
    document.getElementById("goal-title").value = "Goal A";
    document.getElementById("goal-date").value = "2026-04-10";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const dropdown = document.getElementById("rough-goal");
    const goalId = Array.from(dropdown.options)[1].value;

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "3";
    document.getElementById("rough-note").value = "Preparation";
    document.getElementById("rough-goal").value = goalId;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const list = document.getElementById("rough-list");
    expect(list.textContent).toContain("3 h geplant");
    expect(list.textContent).toContain("Goal A");
    expect(list.textContent).toContain("Preparation");
    expect(list.textContent).toContain("KW 11/2026");
  });

  it("bearbeitet eine Grobplanung inklusive Zielzuordnung", () => {
    document.getElementById("goal-title").value = "Goal X";
    document.getElementById("goal-date").value = "2026-04-15";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "4";
    document.getElementById("rough-note").value = "Initial";
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const list = document.getElementById("rough-list");
    const editButton = list.querySelector("button[aria-label='Bearbeiten']");
    expect(editButton).toBeTruthy();

    editButton.click();

    expect(document.getElementById("rough-edit-id").value).toBeTruthy();
    expect(document.getElementById("rough-week").value).toBe("2026-W11");
    expect(document.getElementById("rough-hours").value).toBe("4");
    expect(document.getElementById("rough-note").value).toBe("Initial");
    expect(document.getElementById("rough-submit").textContent).toBe("Änderungen speichern");
    expect(document.getElementById("rough-cancel-edit").classList.contains("d-none")).toBe(false);

    document.getElementById("rough-hours").value = "5";
    document.getElementById("rough-note").value = "Updated";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;

    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    const plan = parsed.roughPlans[0];
    expect(plan.hours).toBe(5);
    expect(plan.note).toBe("Updated");
    expect(plan.goalId).toBeTruthy();

    expect(document.getElementById("rough-edit-id").value).toBe("");
    expect(document.getElementById("rough-submit").textContent).toBe("Planen");
    expect(document.getElementById("rough-cancel-edit").classList.contains("d-none")).toBe(true);
  });

  it("bricht die Bearbeitung einer Grobplanung ab und setzt das Formular zurueck", () => {
    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "2";
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const list = document.getElementById("rough-list");
    const editButton = list.querySelector("button[aria-label='Bearbeiten']");
    editButton.click();

    expect(document.getElementById("rough-edit-id").value).toBeTruthy();

    document.getElementById("rough-cancel-edit").click();

    expect(document.getElementById("rough-edit-id").value).toBe("");
    expect(document.getElementById("rough-week").value).toBe("");
    expect(document.getElementById("rough-hours").value).toBe("");
    expect(document.getElementById("rough-note").value).toBe("");
    expect(document.getElementById("rough-goal").value).toBe("");
    expect(document.getElementById("rough-submit").textContent).toBe("Planen");
    expect(document.getElementById("rough-cancel-edit").classList.contains("d-none")).toBe(true);
  });

  it("bearbeitet einen bestehenden Detaileintrag direkt im Monatsblock", () => {
    document.getElementById("goal-title").value = "Edit Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Alt Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "3";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    let detailForm = document.querySelector("[data-detail-block-form]");
    let milestoneSelect = detailForm.querySelector("select");
    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "10:00";
    detailForm.querySelector("[data-detail-end]").value = "10:30";
    detailForm.querySelector('input[type="text"]').value = "Erster Stand";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.querySelector('[aria-label="Detailplanung bearbeiten"]').click();

    detailForm = document.querySelector("[data-detail-block-form]");
    expect(detailForm.querySelector("[data-detail-cancel]")?.classList.contains("d-none")).toBe(
      false
    );
    detailForm.querySelector("[data-detail-start]").value = "11:00";
    detailForm.querySelector("[data-detail-end]").value = "11:45";
    detailForm.querySelector('input[type="text"]').value = "Überarbeitet";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.getElementById("detail-list").textContent).toContain(
      "45 Min für Alt Zwischenziel"
    );
    expect(document.getElementById("detail-list").textContent).toContain("Überarbeitet");
    expect(document.getElementById("detail-list").textContent).toContain(
      "Verteilt: 45 von 180 Min"
    );
  });

  it("leitet Detailminuten aus der ausgewaehlten Start- und Endzeit ab", () => {
    document.getElementById("goal-title").value = "Zeitformat Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Zeitformat Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "5";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailForm = document.querySelector("[data-detail-block-form]");
    const milestoneSelect = detailForm.querySelector("select");

    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "08:00";
    detailForm.querySelector("[data-detail-end]").value = "09:20";
    detailForm.querySelector('input[type="text"]').value = "Fruehe Einheit";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "10:00";
    detailForm.querySelector("[data-detail-end]").value = "12:30";
    detailForm.querySelector('input[type="text"]').value = "Mittags Einheit";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    const earlyPlan = parsed.detailPlans.find((item) => item.topic === "Fruehe Einheit");
    const middayPlan = parsed.detailPlans.find((item) => item.topic === "Mittags Einheit");

    expect(earlyPlan.minutes).toBe(80);
    expect(middayPlan.minutes).toBe(150);
    expect(document.getElementById("detail-list").textContent).toContain(
      "80 Min für Zeitformat Zwischenziel"
    );
    expect(document.getElementById("detail-list").textContent).toContain(
      "150 Min für Zeitformat Zwischenziel"
    );
  });

  it("erlaubt Detailplanung mit Freitext und optionalem Meilenstein in einem Grobblock", () => {
    document.getElementById("goal-title").value = "Freitext Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Optionales Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W11";
    document.getElementById("rough-hours").value = "4";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailForm = document.querySelector("[data-detail-block-form]");
    detailForm.querySelector("[data-detail-start]").value = "13:00";
    detailForm.querySelector("[data-detail-end]").value = "13:35";
    detailForm.querySelector('input[type="text"]').value = "Freitext ohne Zwischenziel";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    const freeTextDetail = parsed.detailPlans.find(
      (item) => item.topic === "Freitext ohne Zwischenziel"
    );
    expect(freeTextDetail).toBeTruthy();
    expect(freeTextDetail.milestoneId).toBe(null);
    expect(document.getElementById("detail-list").textContent).toContain(
      "35 Min für Freitext ohne Zwischenziel"
    );
  });

  it("zeigt den zusaetzlichen Detailblock immer an und erlaubt Detailplanung ohne Grobplanung", () => {
    const additionalForm = document.querySelector('[data-detail-block-form="additional"]');
    expect(document.getElementById("detail-list").textContent).toContain("Weitere Detailplanung");
    expect(additionalForm).toBeTruthy();

    additionalForm.querySelector("[data-detail-start]").value = "14:00";
    additionalForm.querySelector("[data-detail-end]").value = "15:15";
    additionalForm.querySelector('input[type="text"]').value = "Unabhängige Detailplanung";
    additionalForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    const extraDetail = parsed.detailPlans.find(
      (item) => item.topic === "Unabhängige Detailplanung"
    );
    expect(extraDetail).toBeTruthy();
    expect(extraDetail.roughPlanId).toBe(null);
    expect(document.getElementById("detail-list").textContent).toContain(
      "75 Min für Unabhängige Detailplanung"
    );
  });

  it("verknuepft getrackte Zeit mit dem ausgewaehlten Detaileintrag und zeigt Fortschritt an", () => {
    document.getElementById("goal-title").value = "Tracking Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Tracking Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W13";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailForm = document.querySelector("[data-detail-block-form]");
    const milestoneSelect = detailForm.querySelector("select");
    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "09:00";
    detailForm.querySelector("[data-detail-end]").value = "10:00";
    detailForm.querySelector('input[type="text"]').value = "Session A";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const startTrackingButton = document.querySelector("[data-detail-start-tracking]");
    const detailId = startTrackingButton.getAttribute("data-detail-start-tracking");
    startTrackingButton.click();

    expect(document.getElementById("track-detail-select").value).toBe(detailId);

    vi.advanceTimersByTime(2 * 60 * 1000);
    document.getElementById("timer-stop").click();

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    const session = parsed.trackedSessions.find((item) => item.detailPlanId === detailId);
    expect(session).toBeTruthy();
    expect(session.minutes).toBe(2);
    expect(document.getElementById("detail-list").textContent).toContain("Getrackt: 2 von 60 Min");
  });

  it("stoppt und speichert den aktuellen Timer automatisch beim Wechsel des Detaileintrags", () => {
    document.getElementById("goal-title").value = "Switch Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Switch Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W13";
    document.getElementById("rough-hours").value = "3";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailForm = document.querySelector("[data-detail-block-form]");
    const milestoneSelect = detailForm.querySelector("select");

    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "09:00";
    detailForm.querySelector("[data-detail-end]").value = "09:30";
    detailForm.querySelector('input[type="text"]').value = "Switch A";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "10:00";
    detailForm.querySelector("[data-detail-end]").value = "10:30";
    detailForm.querySelector('input[type="text"]').value = "Switch B";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    let buttons = Array.from(document.querySelectorAll("[data-detail-start-tracking]"));
    expect(buttons).toHaveLength(2);

    const firstId = buttons[0].getAttribute("data-detail-start-tracking");
    const secondId = buttons[1].getAttribute("data-detail-start-tracking");

    buttons[0].click();
    document.getElementById("track-note").value = "Laufende Session";
    vi.advanceTimersByTime(60 * 1000);

    buttons = Array.from(document.querySelectorAll("[data-detail-start-tracking]"));
    buttons[1].click();

    const parsedAfterSwitch = JSON.parse(localStorage.getItem("focusflow-v1"));
    const firstSession = parsedAfterSwitch.trackedSessions.find(
      (item) => item.detailPlanId === firstId
    );
    expect(firstSession).toBeTruthy();
    expect(firstSession.note).toContain("Laufende Session");
    expect(firstSession.note).toContain("Automatisch beendet");
    expect(document.getElementById("track-detail-select").value).toBe(secondId);
  });

  it("speichert eine manuell erfasste Session mit ausgewaehltem Detailplan und Notiz", () => {
    document.getElementById("goal-title").value = "Manual Goal";
    document.getElementById("goal-date").value = "2026-03-25";
    document
      .getElementById("goal-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const milestoneInput = document.querySelector(
      "#goal-list input[aria-label^='Zwischenziel für']"
    );
    milestoneInput.value = "Manual Zwischenziel";
    milestoneInput
      .closest("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.getElementById("rough-week").value = "2026-W13";
    document.getElementById("rough-hours").value = "2";
    document.getElementById("rough-goal").value = Array.from(
      document.getElementById("rough-goal").options
    )[1].value;
    document
      .getElementById("rough-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailForm = document.querySelector("[data-detail-block-form]");
    const milestoneSelect = detailForm.querySelector("select");
    milestoneSelect.value = Array.from(milestoneSelect.options)[1].value;
    detailForm.querySelector("[data-detail-start]").value = "12:00";
    detailForm.querySelector("[data-detail-end]").value = "12:30";
    detailForm.querySelector('input[type="text"]').value = "Manual Detail";
    detailForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const detailId = document
      .querySelector("[data-detail-start-tracking]")
      .getAttribute("data-detail-start-tracking");

    document.getElementById("track-detail-select").value = detailId;
    document
      .getElementById("track-detail-select")
      .dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("track-note").value = "Manuelle Nachtragung";
    document.getElementById("track-manual-date").value = "2026-03-24";
    document.getElementById("track-manual-minutes").value = "35";
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    const manualSession = parsed.trackedSessions.find(
      (session) => session.detailPlanId === detailId && session.note === "Manuelle Nachtragung"
    );
    expect(manualSession).toBeTruthy();
    expect(manualSession.minutes).toBe(35);
    expect(document.getElementById("track-list").textContent).toContain("Manuelle Nachtragung");
    expect(document.getElementById("track-list").textContent).toContain("Detail:");
  });

  it("bearbeitet eine bestehende getrackte Session ueber die Stift-Aktion", () => {
    document.getElementById("track-note").value = "Erste Fassung";
    document.getElementById("track-manual-date").value = "2026-03-24";
    document.getElementById("track-manual-minutes").value = "25";
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    document.querySelector("#track-list [data-tracked-edit]")?.click();

    expect(document.getElementById("track-manual-submit").textContent).toContain("speichern");
    expect(document.getElementById("track-note").value).toBe("Erste Fassung");
    expect(document.getElementById("track-manual-minutes").value).toBe("25");

    document.getElementById("track-note").value = "Bearbeitete Session";
    document.getElementById("track-manual-date").value = "2026-03-25";
    document.getElementById("track-manual-minutes").value = "40";
    document
      .getElementById("track-manual-form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const parsed = JSON.parse(localStorage.getItem("focusflow-v1"));
    expect(parsed.trackedSessions).toHaveLength(1);
    expect(parsed.trackedSessions[0]).toMatchObject({
      minutes: 40,
      note: "Bearbeitete Session",
    });
    expect(parsed.trackedSessions[0].start.startsWith("2026-03-25")).toBe(true);
    expect(document.getElementById("track-list").textContent).toContain("Bearbeitete Session");
    expect(document.getElementById("track-edit-id").value).toBe("");
  });

  it("bootstrappt auch ohne matchMedia und beendet sauber", async () => {
    appModule.shutdown();

    appModule = await bootApp({ matchMediaMode: "none" });

    expect(document.querySelectorAll("[data-main-card-body]").length).toBeGreaterThan(0);
    expect(() => appModule.shutdown()).not.toThrow();

    appModule = await bootApp();
  });

  it("faellt fuer Breakpoint-Listener auf addListener und removeListener zurueck", async () => {
    appModule.shutdown();

    appModule = await bootApp({ matchMediaMode: "legacy" });

    const goalCardBody = document.querySelector('[data-main-card-body="goals"]');
    expect(goalCardBody.classList.contains("d-none")).toBe(false);

    breakpointController.update(false);
    expect(goalCardBody.classList.contains("d-none")).toBe(true);

    breakpointController.update(true);
    expect(goalCardBody.classList.contains("d-none")).toBe(false);
  });

  it("ueberschreibt einen bereits gespeicherten Kalendermonat beim Bootstrap nicht", async () => {
    appModule.shutdown();

    appModule = await bootApp({
      storedState: {
        settings: {
          themeMode: "auto",
          activeView: "list",
          calendarMonth: "2026-02",
        },
      },
    });

    const persisted = JSON.parse(localStorage.getItem("focusflow-v1"));
    expect(persisted.settings.calendarMonth).toBe("2026-02");
    expect(document.getElementById("month-select").value).toBe("2026-03");
  });
});

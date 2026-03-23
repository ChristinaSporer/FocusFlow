const fs = require("node:fs");
const path = require("node:path");

function loadDomWithoutScript() {
  const htmlPath = path.resolve(__dirname, "../../index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : "";
  document.body.innerHTML = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, "");
}

describe("App UI integration (jsdom)", () => {
  let appModule;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));

    localStorage.clear();
    loadDomWithoutScript();

    window.alert = vi.fn();
    window.confirm = vi.fn(() => true);
    window.Notification = {
      permission: "denied",
      requestPermission: vi.fn(async () => "denied"),
    };

    vi.resetModules();
    appModule = await import("../../app.js");
    appModule.bootstrap();
  });

  afterEach(() => {
    if (appModule?.shutdown) {
      appModule.shutdown();
    }

    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("adds a goal and persists it in localStorage", () => {
    const title = "SE Lernziel";
    const date = "2026-03-15";

    document.getElementById("goal-title").value = title;
    document.getElementById("goal-date").value = date;

    const form = document.getElementById("goal-form");
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(document.getElementById("goal-list").textContent).toContain(title);

    const raw = localStorage.getItem("lernzeitplaner-poc-v1");
    const parsed = JSON.parse(raw);
    expect(parsed.goals).toHaveLength(1);
    expect(parsed.goals[0].title).toBe(title);
    expect(parsed.goals[0].targetDate).toBe(date);
  });

  it("switches to calendar view and renders source-colored events", () => {
    document.getElementById("detail-date").value = "2026-03-10";
    document.getElementById("detail-minutes").value = "90";
    document.getElementById("detail-topic").value = "Architektur";
    document.getElementById("detail-form").dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );

    document.getElementById("tab-calendar").click();

    expect(document.getElementById("calendar-view").classList.contains("d-none")).toBe(false);
    expect(document.getElementById("list-view").classList.contains("d-none")).toBe(true);
    expect(document.querySelector(".calendar-event.source-detail")?.textContent).toContain("Architektur");
  });
});

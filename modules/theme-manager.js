export function normalizeThemeMode(mode) {
  return ["auto", "light", "dark"].includes(mode) ? mode : "auto";
}

export function createThemeManager({ getThemeMode }) {
  let systemThemeMediaQuery = null;
  let onChange = null;

  function applyTheme(mode = getThemeMode()) {
    const normalizedMode = normalizeThemeMode(mode);
    let resolvedTheme = normalizedMode;

    if (normalizedMode === "auto") {
      const prefersDark = Boolean(systemThemeMediaQuery && systemThemeMediaQuery.matches);
      resolvedTheme = prefersDark ? "dark" : "light";
    }

    document.documentElement.setAttribute("data-bs-theme", resolvedTheme);
  }

  function initSystemTheme() {
    if (typeof window.matchMedia !== "function") {
      applyTheme();
      return;
    }

    systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    applyTheme("auto");

    onChange = () => {
      if (normalizeThemeMode(getThemeMode()) === "auto") {
        applyTheme("auto");
      }
    };

    if (typeof systemThemeMediaQuery.addEventListener === "function") {
      systemThemeMediaQuery.addEventListener("change", onChange);
    } else if (typeof systemThemeMediaQuery.addListener === "function") {
      systemThemeMediaQuery.addListener(onChange);
    }
  }

  function dispose() {
    if (!systemThemeMediaQuery || !onChange) return;

    if (typeof systemThemeMediaQuery.removeEventListener === "function") {
      systemThemeMediaQuery.removeEventListener("change", onChange);
    } else if (typeof systemThemeMediaQuery.removeListener === "function") {
      systemThemeMediaQuery.removeListener(onChange);
    }

    systemThemeMediaQuery = null;
    onChange = null;
  }

  return {
    applyTheme,
    initSystemTheme,
    dispose,
  };
}

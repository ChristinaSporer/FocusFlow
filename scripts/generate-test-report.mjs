import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { unit: null, e2e: null, output: "test-results/ci-test-report.md" };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === "--unit") args.unit = value;
    if (key === "--e2e") args.e2e = value;
    if (key === "--output") args.output = value;
  }
  return args;
}

function ensureDirectory(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function findFile(rootDir, predicate) {
  if (!rootDir || !fs.existsSync(rootDir)) return null;
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(fullPath, predicate);
      if (found) return found;
      continue;
    }
    if (predicate(fullPath)) return fullPath;
  }
  return null;
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function collectVitestTests(report) {
  if (!report?.testResults) return [];
  return report.testResults.flatMap((suite) => {
    const fileLabel = suite.name || suite.assertionResults?.[0]?.ancestorTitles?.[0] || "Vitest";
    return (suite.assertionResults || []).map((assertion) => ({
      source: "Unit",
      file: fileLabel,
      title:
        assertion.fullName || [...(assertion.ancestorTitles || []), assertion.title].join(" > "),
      status: assertion.status || "unknown",
      durationMs: assertion.duration ?? 0,
    }));
  });
}

function collectPlaywrightTests(report) {
  const tests = [];

  function visitSuite(suite, titlePath = []) {
    const currentPath = suite.title ? [...titlePath, suite.title] : titlePath;

    for (const spec of suite.specs || []) {
      const baseTitle = [...currentPath, spec.title].filter(Boolean).join(" > ");
      for (const test of spec.tests || []) {
        const results = test.results || [];
        const lastResult = results.at(-1) || {};
        const projectSuffix = test.projectName ? ` [${test.projectName}]` : "";
        tests.push({
          source: "E2E",
          file: suite.location?.file || spec.file || "Playwright",
          title: `${baseTitle}${projectSuffix}`,
          status: lastResult.status || test.status || "unknown",
          durationMs: results.reduce((sum, result) => sum + (result.duration || 0), 0),
        });
      }
    }

    for (const childSuite of suite.suites || []) {
      visitSuite(childSuite, currentPath);
    }
  }

  for (const suite of report?.suites || []) {
    visitSuite(suite, []);
  }

  return tests;
}

function formatStatusCounts(tests) {
  const counts = tests.reduce((acc, test) => {
    acc[test.status] = (acc[test.status] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([status, count]) => `${status}: ${count}`)
    .join(", ");
}

function formatTable(tests) {
  if (!tests.length) return "_Keine Ergebnisse gefunden._\n";
  const lines = ["| Status | Test | Datei | Dauer |", "| --- | --- | --- | ---: |"];
  for (const test of tests) {
    lines.push(
      `| ${test.status} | ${test.title.replace(/\|/g, "\\|")} | ${String(test.file).replace(/\|/g, "\\|")} | ${test.durationMs} ms |`
    );
  }
  return `${lines.join("\n")}\n`;
}

const args = parseArgs(process.argv.slice(2));
const vitestFile = findFile(args.unit, (filePath) => filePath.endsWith(`${path.sep}results.json`));
const playwrightFile = findFile(args.e2e, (filePath) =>
  filePath.endsWith(`${path.sep}results.json`)
);

const vitestTests = collectVitestTests(readJson(vitestFile));
const playwrightTests = collectPlaywrightTests(readJson(playwrightFile));
const allTests = [...vitestTests, ...playwrightTests];

const report = [
  "# CI-Testreport",
  "",
  `Erstellt am: ${new Date().toISOString()}`,
  "",
  `Gesamtzahl erfasster Tests: ${allTests.length}`,
  allTests.length
    ? `Statusverteilung: ${formatStatusCounts(allTests)}`
    : "Statusverteilung: keine Daten",
  "",
  "## Unit-Tests (Vitest)",
  "",
  `Erfasste Tests: ${vitestTests.length}`,
  vitestTests.length
    ? `Statusverteilung: ${formatStatusCounts(vitestTests)}`
    : "Statusverteilung: keine Daten",
  "",
  formatTable(vitestTests),
  "## E2E-Tests (Playwright)",
  "",
  `Erfasste Tests: ${playwrightTests.length}`,
  playwrightTests.length
    ? `Statusverteilung: ${formatStatusCounts(playwrightTests)}`
    : "Statusverteilung: keine Daten",
  "",
  formatTable(playwrightTests),
].join("\n");

ensureDirectory(args.output);
fs.writeFileSync(args.output, report, "utf8");
console.log(`Testreport geschrieben: ${args.output}`);

// Audit automatisé (axe-core) des deux écrans clés retenus pour l'audit RGAA 4 partiel
// (pu/parcours-utilisateur.md §6) : recherche et connexion/MFA. Contre le prototype docker-compose
// réellement démarré — pas une maquette statique.
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const axeSource = readFileSync(
  path.join(__dirname, "node_modules/axe-core/axe.min.js"),
  "utf-8"
);

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";

const PAGES = [
  { id: "recherche-fr", url: `${BASE_URL}/fr`, label: "Recherche (FR)", keyboardSteps: 8 },
  { id: "connexion-fr", url: `${BASE_URL}/fr/connexion`, label: "Connexion, étape 1 — identifiants (FR)", keyboardSteps: 5 },
  {
    id: "connexion-mfa-fr",
    url: `${BASE_URL}/fr/connexion`,
    label: "Connexion, étape 2 — code MFA (FR)",
    keyboardSteps: 3,
    beforeAudit: async (page) => {
      await page.fill("#login-email", "client@example.com");
      await page.fill("#login-password", "Demo1234!");
      await page.click('button[type="submit"]');
      await page.waitForSelector("#login-mfa-code", { timeout: 10000 });
    },
  },
  { id: "recherche-ar", url: `${BASE_URL}/ar`, label: "Recherche (AR, RTL)" },
];

const outDir = path.join(__dirname, "results");
mkdirSync(outDir, { recursive: true });

// axe-core vérifie l'arbre d'accessibilité statique, pas l'ordre de tabulation réel ni la
// visibilité effective du focus : complément manuel-automatisé, au clavier uniquement (T3).
async function traceKeyboard(page, steps) {
  const trace = [];
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press("Tab");
    // eslint-disable-next-line no-undef
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 40),
        outline: style.outlineStyle,
      };
    });
    trace.push(info);
  }
  return trace;
}

const browser = await chromium.launch();
const summary = [];

for (const target of PAGES) {
  const page = await browser.newPage();
  await page.goto(target.url, { waitUntil: "networkidle" });
  if (target.beforeAudit) {
    await target.beforeAudit(page);
  }

  const keyboardTrace = target.keyboardSteps ? await traceKeyboard(page, target.keyboardSteps) : null;

  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] },
    });
  });

  writeFileSync(path.join(outDir, `${target.id}.json`), JSON.stringify(results, null, 2));

  summary.push({
    id: target.id,
    label: target.label,
    url: target.url,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
    })),
    passes: results.passes.length,
    incomplete: results.incomplete.map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.length })),
    keyboardTrace,
  });

  await page.close();
  const kbNote = keyboardTrace
    ? `, focus perdu: ${keyboardTrace.some((s) => s === null) ? "oui" : "non"}, outline absent: ${keyboardTrace.some((s) => s && s.outline === "none") ? "oui" : "non"}`
    : "";
  console.log(`${target.label}: ${results.violations.length} violation(s), ${results.passes.length} règle(s) passée(s)${kbNote}`);
}

await browser.close();

writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
console.log("\nRésumé écrit dans accessibilite/results/summary.json");

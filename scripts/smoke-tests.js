// Smoke tests Long List — n'effectue PAS d'appel Claude (gratuit à exécuter).
// Couvre : validation payload, matching DB, filtrage providers, PDF, email fallback.
// Usage : node scripts/smoke-tests.js

require("dotenv").config({ override: true });
const fs = require("fs");
const path = require("path");

const { validatePayload } = require("../src/controllers/longlist");
const matching = require("../src/services/longlist/matching");
const pdf = require("../src/services/longlist/pdf");
const email = require("../src/services/longlist/email");

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, label) {
  if (cond) {
    console.log(`  ✓ ${label}`);
    pass++;
  } else {
    console.log(`  ✗ ${label}`);
    fail++;
    failures.push(label);
  }
}

function group(name, fn) {
  console.log(`\n━ ${name}`);
  return fn();
}

(async () => {
  await group("Validation payload", () => {
    const ok = validatePayload({
      email: "a@b.co",
      companyName: "X",
      answers: { q: "v" },
      categoryIds: [1, 2, 3],
    });
    assert(ok === null, "valid payload accepté");

    assert(
      validatePayload({ answers: {}, categoryIds: [1] }) === "Email invalide ou manquant",
      "email manquant rejeté"
    );
    assert(
      validatePayload({ email: "not-an-email", answers: { q: "v" }, categoryIds: [1] }) ===
        "Email invalide ou manquant",
      "email mal formé rejeté"
    );
    assert(
      validatePayload({ email: "a".repeat(250) + "@b.co", answers: { q: "v" }, categoryIds: [1] }) ===
        "Email trop long",
      "email > 254 chars rejeté"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: null, categoryIds: [1] }) ===
        "Answers manquant ou invalide",
      "answers null rejeté"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: [1, 2], categoryIds: [1] }) ===
        "Answers manquant ou invalide",
      "answers array rejeté"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: {}, categoryIds: [1] }) === "Answers vide",
      "answers objet vide rejeté"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: { q: "v" }, categoryIds: [] }) ===
        "Au moins une catégorie doit être sélectionnée",
      "categoryIds vide rejeté"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: { q: "v" }, categoryIds: [1, 1, 2] }) ===
        "categoryIds contient des doublons",
      "categoryIds doublons rejetés"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: { q: "v" }, categoryIds: [9999] }) ===
        "categoryId invalide : 9999",
      "categoryId hors range rejeté"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: { q: "v" }, categoryIds: [1.5] }) ===
        "categoryId invalide : 1.5",
      "categoryId non entier rejeté"
    );
    assert(
      validatePayload({ email: "a@b.co", answers: { q: { nested: 1 } }, categoryIds: [1] }) !==
        null,
      "answer object nested rejeté"
    );
    const big = "x".repeat(6000);
    assert(
      validatePayload({ email: "a@b.co", answers: { q: big }, categoryIds: [1] }) ===
        'Answer "q" : valeur trop longue',
      "answer string > 5K rejetée"
    );
    const manyKeys = Object.fromEntries(Array.from({ length: 35 }, (_, i) => [`k${i}`, "v"]));
    assert(
      validatePayload({ email: "a@b.co", answers: manyKeys, categoryIds: [1] }) ===
        "Answers trop nombreuses (max 30)",
      "answers > 30 clés rejetées"
    );
    const bigJson = { k: Array(100).fill("x".repeat(4500)) };
    assert(
      validatePayload({ email: "a@b.co", answers: bigJson, categoryIds: [1] })?.startsWith(
        "Answers trop volumineuses"
      ),
      "answers > 50K bytes rejetées"
    );
    assert(
      validatePayload({
        email: "a@b.co",
        answers: { q: "v" },
        categoryIds: Array(15).fill(0).map((_, i) => i + 1),
      }) === "Trop de catégories (max 14)",
      "categoryIds > 14 rejetés"
    );
  });

  await group("Matching DB", async () => {
    const cats = await matching.getAllCategories();
    assert(cats.length === 14, `getAllCategories renvoie 14 catégories (got ${cats.length})`);

    const empty = await matching.getProvidersForCategories([]);
    assert(empty.length === 0, "getProvidersForCategories([]) → []");

    const one = await matching.getProvidersForCategories([6]); // TRMS
    assert(one.length === 1, "1 catégorie demandée → 1 groupe retourné");
    assert(
      one[0].categoryName.includes("TRMS"),
      `1er groupe est TRMS (got "${one[0].categoryName}")`
    );
    assert(one[0].providers.length > 0, `TRMS contient ≥ 1 provider (got ${one[0].providers.length})`);

    const seven = await matching.getProvidersForCategories([6, 1, 3, 11, 13, 5, 4]);
    assert(seven.length === 7, `7 catégories demandées → 7 groupes (got ${seven.length})`);
    const totalProviders = seven.reduce((acc, g) => acc + g.providers.length, 0);
    assert(totalProviders > 30, `total providers > 30 sur les 7 catégories (got ${totalProviders})`);

    const allNames = seven.flatMap((g) => g.providers.map((p) => p.name));
    const placeholders = allNames.filter((n) => /^Category-\d/i.test(n));
    assert(placeholders.length === 0, `aucun placeholder "Category-N-..." (got ${placeholders.length})`);
  });

  await group("PDF rendering", async () => {
    const fakeMd = `# TREASURY TECHNOLOGY
## TEST REPORT

## CLIENT PROFILE
- **Test field**: test value

## 1. EXECUTIVE SUMMARY
This is a test summary paragraph to validate the PDF rendering pipeline.

| Vendor | Origin | Fit | Comments |
|---|---|---|---|
| **Foo** | EU | ★★★★★ | great |
| **Bar** | US | ★★★☆☆ | ok |

→ **TOP RECOMMENDATION:** Foo wins.
`;
    const r = await pdf.renderPdf({
      markdown: fakeMd,
      fileName: `smoke-test-${Date.now()}.pdf`,
    });
    assert(fs.existsSync(r.path), "PDF file créé");
    assert(r.sizeBytes > 10_000, `PDF > 10KB (got ${r.sizeBytes} bytes)`);
    fs.unlinkSync(r.path); // cleanup
  });

  await group("Email fallback (G_PASSWORD=local-dev-noop)", async () => {
    // Génère un PDF temporaire
    const tmpPdf = path.join(require("os").tmpdir(), `smoke-${Date.now()}.pdf`);
    fs.writeFileSync(tmpPdf, "%PDF-1.4 fake content");
    const r = await email.sendReportEmail({
      to: "smoke@example.com",
      companyName: "Smoke Co",
      pdfPath: tmpPdf,
    });
    assert(r.mode === "fallback", `mode fallback en local (got "${r.mode}")`);
    assert(r.savedTo && fs.existsSync(r.savedTo), "meta.json fallback créé");
    // Cleanup
    fs.unlinkSync(tmpPdf);
    if (r.savedTo) {
      fs.unlinkSync(r.savedTo);
      const pdfFallback = r.savedTo.replace(".json", ".pdf");
      if (fs.existsSync(pdfFallback)) fs.unlinkSync(pdfFallback);
    }
  });

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Résultats : ${pass} ✓  ${fail} ✗`);
  if (fail > 0) {
    console.log("\nFailures :");
    failures.forEach((f) => console.log("  -", f));
    process.exit(1);
  }
  process.exit(0);
})().catch((err) => {
  console.error("\nSMOKE TEST CRASH:", err);
  process.exit(2);
});

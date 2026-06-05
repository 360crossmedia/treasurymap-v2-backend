const fs = require("fs");
const path = require("path");
const os = require("os");
const { marked } = require("marked");
const puppeteer = require("puppeteer");

// Inline le logo TreasuryMap (SVG) au démarrage du module : évite à puppeteer
// d'avoir à charger un asset externe (network ou file://), ce qui fait foirer
// le rendu en environnement sandboxé.
const LOGO_SVG = (() => {
  try {
    return fs.readFileSync(
      path.join(__dirname, "assets/treasurymap-logo.svg"),
      "utf8"
    );
  } catch {
    return "<!-- logo unavailable -->";
  }
})();
const LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

// Style consultant TreasuryMap. Markdown → HTML via marked, puis wrap dans
// un template HTML stylé, puis PDF via puppeteer (Chromium headless).
const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{{TITLE}}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  /* TreasuryMap brand palette · aligned with the redesigned site
     Deep navy #0e2c5c (primary), royal blue #2f6fe0 (accent), sky #19a3e6
     (droplet tip), pale blue tint #eef4ff, neutral inks.
     Source: treasurymap.com footer / GDPR redesign tokens. */
  :root {
    --brand: #2f6fe0;
    --brand-dark: #0e2c5c;
    --brand-sky: #19a3e6;
    --brand-soft: #eef4ff;
    --ink: #0e2c5c;
    --ink-mid: #3a4a66;
    --ink-muted: #6b7794;
    --line: #e1e7f1;
    --surface: #f4f8ff;
  }

  @page { size: A4; margin: 22mm 18mm 24mm 18mm; }
  html, body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; color: var(--ink-mid); font-size: 10.5pt; line-height: 1.5; }
  body { margin: 0; }

  /* Title block (first page) */
  h1 { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 28pt; color: var(--brand-dark); margin: 0 0 4pt 0; letter-spacing: -0.6px; font-weight: 700; }
  h1 + h2 { margin-top: 4pt; font-size: 14pt; color: var(--brand); border: none; padding: 0; font-weight: 500; letter-spacing: 0.5pt; }
  h1 + h2 + p em { color: var(--brand); font-style: normal; font-weight: 500; }

  /* Section headings · cyan underline like the website */
  h2 { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 16pt; color: var(--ink); margin: 26pt 0 10pt 0; padding-bottom: 6pt; border-bottom: 2px solid var(--brand); font-weight: 700; letter-spacing: -0.2px; }
  h3 { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; font-size: 12.5pt; color: var(--brand-dark); margin: 18pt 0 6pt 0; font-weight: 600; }
  h4 { font-size: 11pt; color: var(--ink); margin: 10pt 0 4pt 0; font-weight: 600; }

  p { margin: 6pt 0; text-align: justify; color: var(--ink-mid); }
  ul, ol { margin: 6pt 0 6pt 18pt; padding: 0; }
  li { margin: 2pt 0; }
  strong { color: var(--ink); font-weight: 600; }
  em { color: var(--ink-muted); }
  a { color: var(--brand-dark); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: var(--surface); padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; color: var(--brand-dark); }
  hr { border: none; border-top: 1px solid var(--line); margin: 14pt 0; }

  /* Tables · cyan headers, soft alternation, no dated brown */
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt 0; font-size: 9.5pt; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  th { background: var(--brand-dark); color: #fff; text-align: left; padding: 6pt 8pt; font-weight: 600; font-size: 9.5pt; letter-spacing: 0.2px; }
  td { padding: 6pt 8pt; vertical-align: top; border-bottom: 1px solid var(--line); }
  tr:nth-child(even) td { background: var(--surface); }
  td strong { color: var(--brand-dark); }

  blockquote { border-left: 3px solid var(--brand); padding-left: 12pt; color: var(--ink-mid); margin: 8pt 0; font-style: italic; background: var(--brand-soft); padding-top: 6pt; padding-bottom: 6pt; }

  /* Vendor Directory · grid of cards with logo + name + links */
  .vendor-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8pt;
    margin: 8pt 0 16pt 0;
    page-break-inside: auto;
  }
  .vendor-card {
    flex: 0 0 calc((100% - 16pt) / 3);
    box-sizing: border-box;
    border: 1px solid var(--line);
    border-radius: 6pt;
    padding: 8pt;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    page-break-inside: avoid;
    min-height: 110pt;
  }
  .vendor-card img {
    max-width: 80%;
    max-height: 36pt;
    object-fit: contain;
    margin-bottom: 6pt;
  }
  .vendor-logo-placeholder {
    width: 36pt;
    height: 36pt;
    background: var(--brand-soft);
    color: var(--brand-dark);
    border-radius: 4pt;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 11pt;
    margin-bottom: 6pt;
  }
  .vendor-name { font-weight: 700; font-size: 9.5pt; color: var(--ink); margin-bottom: 2pt; }
  .vendor-product { font-size: 8.5pt; color: var(--ink-muted); margin-bottom: 4pt; }
  .vendor-site { font-size: 8.5pt; color: var(--brand-dark); display: block; margin-top: 2pt; }
  .vendor-site-tm { color: var(--brand); }

  /* Further Reading · article cards + video list */
  .reading-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8pt;
    margin: 8pt 0 14pt 0;
  }
  .reading-card {
    flex: 0 0 calc((100% - 8pt) / 2);
    box-sizing: border-box;
    border: 1px solid var(--line);
    border-radius: 6pt;
    overflow: hidden;
    background: #fff;
    display: block;
    color: var(--ink-mid);
    text-decoration: none;
    page-break-inside: avoid;
  }
  .reading-card .reading-cover {
    width: 100%;
    height: 70pt;
    object-fit: cover;
    display: block;
  }
  .reading-card .reading-body {
    padding: 8pt 10pt;
  }
  .reading-vendor {
    font-size: 8pt;
    color: var(--brand-dark);
    text-transform: uppercase;
    letter-spacing: 0.5pt;
    font-weight: 600;
    margin-bottom: 2pt;
  }
  .reading-title {
    font-weight: 600;
    font-size: 10pt;
    color: var(--ink);
    margin-bottom: 4pt;
    line-height: 1.3;
  }
  .reading-intro {
    font-size: 9pt;
    color: var(--ink-muted);
    line-height: 1.35;
  }
  .reading-videos {
    list-style: none;
    margin: 6pt 0 14pt 0;
    padding: 0;
  }
  .reading-videos li {
    padding: 6pt 10pt;
    border-left: 3px solid var(--brand);
    background: var(--surface);
    margin-bottom: 4pt;
    border-radius: 0 4pt 4pt 0;
  }
  .reading-videos a {
    color: var(--ink);
    font-size: 10pt;
  }

  .cover-meta { color: var(--ink-muted); font-size: 10pt; margin-top: 2pt; }
  .footer-disclaimer { color: var(--ink-muted); font-size: 9pt; margin-top: 18pt; padding-top: 8pt; border-top: 1px solid var(--line); font-style: italic; }

  /* Comparison scoring matrix : group rows (CONNECTIVITY & REACH, etc.)
     visually distinct + color-coded scoring cells (●●●●● 5/5 ≥ green, 3/5 = teal,
     ≤ 2/5 = amber). The styling is applied through a markdown post-pass that
     wraps the score text in spans; in the meantime CSS keeps it readable. */
  .compare-matrix {
    margin: 10pt 0 14pt 0;
  }
  table.compare-matrix th {
    text-align: center;
    line-height: 1.25;
    padding: 8pt 6pt;
    font-size: 9pt;
  }
  table.compare-matrix th br + span,
  table.compare-matrix th small {
    display: block;
    font-weight: 400;
    color: rgba(255,255,255,0.85);
    font-size: 8pt;
    margin-top: 2pt;
  }
  table.compare-matrix td {
    text-align: center;
    vertical-align: middle;
    font-size: 9.5pt;
    padding: 5pt 6pt;
  }
  table.compare-matrix td:first-child {
    text-align: left;
    font-weight: 500;
    color: var(--ink);
    padding-left: 10pt;
  }
  /* Group rows : the cell with **CONNECTIVITY & REACH** content. Generated by
     marked as <strong> inside td, with empty other cells. We use :has() to
     style the whole row when its first cell has only a <strong>. */
  table.compare-matrix tr:has(td:first-child strong:only-child) td {
    background: var(--brand-dark) !important;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 8.5pt;
    padding: 4pt 8pt;
    border: none;
  }
  table.compare-matrix tr:has(td:first-child strong:only-child) td strong {
    color: #fff;
  }
  table.compare-matrix tr:has(td:first-child strong:only-child) td:not(:first-child) {
    visibility: hidden;
  }
  /* OVERALL SCORE row : full bold + soft cyan tint */
  table.compare-matrix tr:last-child td {
    background: var(--brand-soft) !important;
    font-weight: 700;
    color: var(--brand-dark);
    border-top: 2px solid var(--brand);
    font-size: 10.5pt;
  }
  /* Score badges injected by post-processor : .score-hi (green), .score-mid (teal), .score-lo (amber) */
  .score-hi { color: #0e2c5c; font-weight: 700; }
  .score-mid { color: #2f6fe0; font-weight: 600; }
  .score-lo { color: #b45309; font-weight: 500; }

  /* Strengths / Limitations / Best Fit blocks · visual distinction */
  h3 + p + strong + ul,
  h3 ~ ul {
    margin-top: 4pt;
  }
  /* When a list item starts with "+ " or "− ", color the marker */
  .compare-pros li { list-style: none; padding-left: 16pt; position: relative; }
  .compare-pros li::before { content: "+"; position: absolute; left: 0; color: #2f6fe0; font-weight: 700; }
  .compare-cons li { list-style: none; padding-left: 16pt; position: relative; }
  .compare-cons li::before { content: "−"; position: absolute; left: 0; color: #B45309; font-weight: 700; }

  /* Cover banner · page 1 hero. On reste dans la zone imprimable (sans bleed
     full-width) pour éviter le clip Chrome/puppeteer. Bordure cyan en haut +
     coin arrondi en bas pour rester graphiquement fort sans déborder. */
  .cover-banner {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #0e2c5c 0%, #1e478f 52%, #2f6fe0 100%);
    color: #fff;
    padding: 32pt 30pt 36pt 30pt;
    margin: 0 0 24pt 0;
    border-radius: 12pt;
    box-shadow: 0 6pt 22pt rgba(14, 44, 92, 0.22);
    page-break-after: avoid;
  }
  /* Decorative droplet watermark (the site's map-pin logo), top-right */
  .cover-banner .cover-droplet {
    position: absolute;
    top: -14pt;
    right: 18pt;
    width: 96pt;
    height: 124pt;
    opacity: 0.16;
    z-index: 0;
  }
  .cover-banner .cover-head {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10pt;
    margin-bottom: 20pt;
  }
  .cover-banner .cover-logo {
    height: 26pt;
    filter: brightness(0) invert(1); /* logo en blanc sur fond navy */
    display: block;
  }
  .cover-banner h1 {
    position: relative;
    z-index: 1;
    color: #fff;
    margin: 0;
    font-size: 28pt;
    letter-spacing: -0.6px;
    line-height: 1.1;
    font-weight: 800;
  }
  .cover-banner .cover-subtitle {
    position: relative;
    z-index: 1;
    color: rgba(255,255,255,0.92);
    font-size: 13pt;
    margin-top: 8pt;
    font-weight: 500;
    letter-spacing: 0.3pt;
  }
  .cover-banner .cover-tagline {
    position: relative;
    z-index: 1;
    color: rgba(255,255,255,0.80);
    font-size: 9.5pt;
    margin-top: 16pt;
    border-top: 1px solid rgba(255,255,255,0.3);
    padding-top: 10pt;
    font-style: italic;
  }

  /* Hide the first markdown h1/h2 because they're duplicated by the banner */
  body > h1:first-of-type { display: none; }
  body > h1:first-of-type + h2 { display: none; }
  body > h1:first-of-type + h2 + p { display: none; }
</style>
</head>
<body>
<div class="cover-banner">
  <svg class="cover-droplet" viewBox="0 0 40 52" fill="none" aria-hidden="true">
    <path d="M20 1.6C10.9 1.6 3.5 9 3.5 18.1c0 11.6 16.5 31.9 16.5 31.9S36.5 29.7 36.5 18.1C36.5 9 29.1 1.6 20 1.6Z" fill="#fff" />
    <circle cx="20" cy="18" r="7" fill="#0e2c5c" />
  </svg>
  <div class="cover-head">
    <img class="cover-logo" src="{{LOGO_URI}}" alt="TreasuryMap" />
  </div>
  <h1>Treasury Technology</h1>
  <div class="cover-subtitle">Long List &amp; Selection Framework</div>
  <div class="cover-tagline">Based on the Treasury Technology Map · www.treasurymap.com</div>
</div>
{{CONTENT}}
</body>
</html>`;

const HEADER_TEMPLATE = `
<div style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 8pt; color: #0e2c5c; width: 100%; padding: 0 18mm; box-sizing: border-box; display: flex; justify-content: space-between; border-bottom: 1px solid #eef4ff;">
  <span><strong style="color: #2f6fe0;">TreasuryMap</strong> | Long List &amp; Selection Framework</span>
  <span>{{MONTH_YEAR}}</span>
</div>`;

const FOOTER_TEMPLATE = `
<div style="font-family: 'Inter', Helvetica, Arial, sans-serif; font-size: 8pt; color: #6b7794; width: 100%; padding: 0 18mm; box-sizing: border-box; display: flex; justify-content: space-between;">
  <span><a href="https://www.treasurymap.com" style="color: #2f6fe0; text-decoration: none;">www.treasurymap.com</a> · Confidential</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

/**
 * Convertit un rapport markdown en PDF.
 *
 * @param {object} opts
 * @param {string} opts.markdown - le rapport généré par Claude
 * @param {string} [opts.title] - titre du document (défaut: "TreasuryMap Long List")
 * @param {string} [opts.outputDir] - dossier de sortie (défaut: os.tmpdir())
 * @param {string} [opts.fileName] - nom du fichier (défaut: longlist-{timestamp}.pdf)
 * @returns {Promise<{path:string, sizeBytes:number}>}
 */
async function renderPdf({
  markdown,
  title = "TreasuryMap Long List",
  outputDir = path.join(os.tmpdir(), "longlist-pdfs"),
  fileName,
}) {
  if (!markdown || typeof markdown !== "string") {
    throw new Error("markdown manquant");
  }
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = fileName || `longlist-${stamp}.pdf`;
  const outPath = path.join(outputDir, file);

  marked.setOptions({ gfm: true, breaks: false });
  const rawHtml = marked.parse(markdown);
  const bodyHtml = postProcessHtml(rawHtml);
  const monthYear = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const html = HTML_TEMPLATE.replace("{{TITLE}}", escapeHtml(title))
    .replace("{{LOGO_URI}}", LOGO_DATA_URI)
    .replace("{{CONTENT}}", bodyHtml);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: HEADER_TEMPLATE.replace("{{MONTH_YEAR}}", monthYear),
      footerTemplate: FOOTER_TEMPLATE,
      margin: { top: "22mm", bottom: "24mm", left: "18mm", right: "18mm" },
    });
  } finally {
    await browser.close();
  }

  return { path: outPath, sizeBytes: fs.statSync(outPath).size };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Post-process the markdown-rendered HTML to add semantic CSS classes that
 * `marked` itself can't infer. Two main jobs:
 *
 * 1. Tag the comparison scoring table with `.compare-matrix` so its specific
 *    styles kick in (group rows, OVERALL SCORE row, score color coding).
 *    Detection : any <table> that contains an "OVERALL SCORE" row OR has
 *    score patterns like ●●●●○ 4/5 in cells.
 * 2. Wrap each score badge in a span (.score-hi / .score-mid / .score-lo)
 *    so the dots can be color-coded green/teal/amber.
 * 3. Mark Strengths/Limitations list groups so the +/− markers can be styled.
 */
function postProcessHtml(html) {
  let out = html;

  // 1) Mark the comparison scoring table.
  // Detect tables whose body contains "OVERALL SCORE" · that's our matrix.
  out = out.replace(/<table>([\s\S]*?)<\/table>/g, (match, inner) => {
    if (/OVERALL\s+SCORE/i.test(inner)) {
      return `<table class="compare-matrix">${inner}</table>`;
    }
    return match;
  });

  // 2) Wrap each "●...○... X/Y" cell in a color-coded span.
  // Patterns seen : "●●●●● 5/5", "●●●●○ 4/5", "●●○○○ 2/5".
  out = out.replace(
    /(<td[^>]*>)\s*((?:●|○)+)\s*(\d)\s*\/\s*5\s*(<\/td>)/g,
    (_, openTd, dots, score, closeTd) => {
      const n = parseInt(score, 10);
      const cls = n >= 4 ? "score-hi" : n === 3 ? "score-mid" : "score-lo";
      return `${openTd}<span class="${cls}">${dots} ${score}/5</span>${closeTd}`;
    }
  );

  // 3) For Strengths blocks · detect <strong>Strengths</strong> followed by <ul>
  // and tag the UL with .compare-pros. Same for Limitations → .compare-cons.
  // Marked emits <p><strong>Strengths</strong></p><ul>... So we target that pair.
  out = out.replace(
    /<p><strong>Strengths<\/strong><\/p>\s*<ul>/g,
    '<p><strong>Strengths</strong></p><ul class="compare-pros">'
  );
  out = out.replace(
    /<p><strong>Limitations<\/strong><\/p>\s*<ul>/g,
    '<p><strong>Limitations</strong></p><ul class="compare-cons">'
  );

  // 4) Strip the leading "+ " / "− " from each li since the ::before markers will render them.
  out = out.replace(
    /<ul class="compare-pros">([\s\S]*?)<\/ul>/g,
    (m, inner) =>
      `<ul class="compare-pros">${inner.replace(/<li>\s*\+\s*/g, "<li>")}</ul>`
  );
  out = out.replace(
    /<ul class="compare-cons">([\s\S]*?)<\/ul>/g,
    (m, inner) =>
      `<ul class="compare-cons">${inner.replace(/<li>\s*[−-]\s*/g, "<li>")}</ul>`
  );

  return out;
}

module.exports = { renderPdf, postProcessHtml };

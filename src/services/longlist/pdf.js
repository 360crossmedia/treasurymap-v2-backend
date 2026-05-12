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
<style>
  /* TreasuryMap brand palette
     Primary cyan #06B6D4 (logos: navy variant #0E7490)
     Backgrounds: white + soft cyan tint #ECFEFF + neutrals #F3F4F6 #4B5563
     Source: treasurymap.com Tailwind tokens (cyan-500 / cyan-700 / gray-100…) */
  :root {
    --brand: #06B6D4;
    --brand-dark: #0E7490;
    --brand-soft: #ECFEFF;
    --ink: #111827;
    --ink-mid: #374151;
    --ink-muted: #6B7280;
    --line: #E5E7EB;
    --surface: #F9FAFB;
  }

  @page { size: A4; margin: 22mm 18mm 24mm 18mm; }
  html, body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: var(--ink-mid); font-size: 10.5pt; line-height: 1.5; }
  body { margin: 0; }

  /* Title block (first page) */
  h1 { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 28pt; color: var(--brand-dark); margin: 0 0 4pt 0; letter-spacing: -0.6px; font-weight: 700; }
  h1 + h2 { margin-top: 4pt; font-size: 14pt; color: var(--brand); border: none; padding: 0; font-weight: 500; letter-spacing: 0.5pt; }
  h1 + h2 + p em { color: var(--brand); font-style: normal; font-weight: 500; }

  /* Section headings — cyan underline like the website */
  h2 { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 16pt; color: var(--ink); margin: 26pt 0 10pt 0; padding-bottom: 6pt; border-bottom: 2px solid var(--brand); font-weight: 700; letter-spacing: -0.2px; }
  h3 { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12.5pt; color: var(--brand-dark); margin: 18pt 0 6pt 0; font-weight: 600; }
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

  /* Tables — cyan headers, soft alternation, no dated brown */
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt 0; font-size: 9.5pt; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  th { background: var(--brand-dark); color: #fff; text-align: left; padding: 6pt 8pt; font-weight: 600; font-size: 9.5pt; letter-spacing: 0.2px; }
  td { padding: 6pt 8pt; vertical-align: top; border-bottom: 1px solid var(--line); }
  tr:nth-child(even) td { background: var(--surface); }
  td strong { color: var(--brand-dark); }

  blockquote { border-left: 3px solid var(--brand); padding-left: 12pt; color: var(--ink-mid); margin: 8pt 0; font-style: italic; background: var(--brand-soft); padding-top: 6pt; padding-bottom: 6pt; }

  /* Vendor Directory — grid of cards with logo + name + links */
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

  /* Further Reading — article cards + video list */
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

  /* Cover banner — page 1 hero */
  .cover-banner {
    background: linear-gradient(135deg, var(--brand-dark) 0%, var(--brand) 100%);
    color: #fff;
    padding: 32pt 28pt 36pt 28pt;
    margin: 0 -18mm 22pt -18mm;
    border-bottom: 4pt solid var(--brand-dark);
    page-break-after: avoid;
  }
  .cover-banner .cover-logo {
    height: 26pt;
    margin-bottom: 18pt;
    filter: brightness(0) invert(1); /* logo en blanc sur fond cyan */
  }
  .cover-banner h1 {
    color: #fff;
    margin: 0;
    font-size: 26pt;
    letter-spacing: -0.6px;
  }
  .cover-banner .cover-subtitle {
    color: rgba(255,255,255,0.85);
    font-size: 12pt;
    margin-top: 6pt;
    font-weight: 500;
    letter-spacing: 0.3pt;
  }
  .cover-banner .cover-tagline {
    color: rgba(255,255,255,0.7);
    font-size: 9.5pt;
    margin-top: 14pt;
    border-top: 1px solid rgba(255,255,255,0.25);
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
  <img class="cover-logo" src="{{LOGO_URI}}" alt="TreasuryMap" />
  <h1>Treasury Technology</h1>
  <div class="cover-subtitle">Long List &amp; Selection Framework</div>
  <div class="cover-tagline">Based on the Treasury Technology Map — www.treasurymap.com</div>
</div>
{{CONTENT}}
</body>
</html>`;

const HEADER_TEMPLATE = `
<div style="font-family: Helvetica, Arial, sans-serif; font-size: 8pt; color: #0E7490; width: 100%; padding: 0 18mm; box-sizing: border-box; display: flex; justify-content: space-between; border-bottom: 1px solid #ECFEFF;">
  <span><strong style="color: #06B6D4;">TreasuryMap</strong> | Long List &amp; Selection Framework</span>
  <span>{{MONTH_YEAR}}</span>
</div>`;

const FOOTER_TEMPLATE = `
<div style="font-family: Helvetica, Arial, sans-serif; font-size: 8pt; color: #6B7280; width: 100%; padding: 0 18mm; box-sizing: border-box; display: flex; justify-content: space-between;">
  <span><a href="https://www.treasurymap.com" style="color: #0E7490; text-decoration: none;">www.treasurymap.com</a> — Confidential</span>
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
  const bodyHtml = marked.parse(markdown);
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

module.exports = { renderPdf };

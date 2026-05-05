const fs = require("fs");
const path = require("path");
const os = require("os");
const { marked } = require("marked");
const puppeteer = require("puppeteer");

// Style consultant TreasuryMap. Markdown → HTML via marked, puis wrap dans
// un template HTML stylé, puis PDF via puppeteer (Chromium headless).
const HTML_TEMPLATE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>{{TITLE}}</title>
<style>
  @page { size: A4; margin: 22mm 18mm 24mm 18mm; }
  html, body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2b2b2b; font-size: 10.5pt; line-height: 1.45; }
  body { margin: 0; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 26pt; color: #0e2a4a; margin: 0 0 4pt 0; letter-spacing: -0.5px; }
  h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 16pt; color: #0e2a4a; margin: 22pt 0 8pt 0; padding-bottom: 4pt; border-bottom: 1px solid #d3a017; }
  h3 { font-family: Georgia, 'Times New Roman', serif; font-size: 13pt; color: #0e2a4a; margin: 16pt 0 6pt 0; }
  h4 { font-size: 11pt; color: #0e2a4a; margin: 10pt 0 4pt 0; }
  p { margin: 6pt 0; text-align: justify; }
  ul { margin: 6pt 0 6pt 18pt; padding: 0; }
  li { margin: 2pt 0; }
  strong { color: #0e2a4a; }
  em { color: #555; }
  code { background: #f4f4f0; padding: 1px 4px; border-radius: 3px; font-size: 9.5pt; }
  hr { border: none; border-top: 1px solid #ddd; margin: 14pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt 0; font-size: 9.5pt; page-break-inside: auto; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  th { background: #0e2a4a; color: #fff; text-align: left; padding: 6pt 8pt; font-weight: 600; font-size: 9.5pt; }
  td { padding: 6pt 8pt; vertical-align: top; border-bottom: 1px solid #e5e5e0; }
  tr:nth-child(even) td { background: #fafaf6; }
  blockquote { border-left: 3px solid #d3a017; padding-left: 12pt; color: #555; margin: 8pt 0; font-style: italic; }
  .cover-meta { color: #555; font-size: 10pt; margin-top: 2pt; }
  .footer-disclaimer { color: #888; font-size: 9pt; margin-top: 18pt; padding-top: 8pt; border-top: 1px solid #ddd; font-style: italic; }
</style>
</head>
<body>
{{CONTENT}}
</body>
</html>`;

const HEADER_TEMPLATE = `
<div style="font-family: Helvetica, Arial, sans-serif; font-size: 8pt; color: #888; width: 100%; padding: 0 18mm; box-sizing: border-box; display: flex; justify-content: space-between;">
  <span>TreasuryMap | Long List & Selection Framework</span>
  <span>{{MONTH_YEAR}}</span>
</div>`;

const FOOTER_TEMPLATE = `
<div style="font-family: Helvetica, Arial, sans-serif; font-size: 8pt; color: #888; width: 100%; padding: 0 18mm; box-sizing: border-box; display: flex; justify-content: space-between;">
  <span>www.treasurymap.com — Confidential</span>
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
  const html = HTML_TEMPLATE.replace("{{TITLE}}", escapeHtml(title)).replace(
    "{{CONTENT}}",
    bodyHtml
  );

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

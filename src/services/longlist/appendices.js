// Build the deterministic markdown appendices that are appended to Claude's
// output before PDF rendering:
//   - Vendor Directory : logo + name + website per category, in a clean grid
//   - Further Reading  : articles/videos from the TreasuryMap newsletter
//
// Both are deterministic (built from DB), so Claude can't hallucinate URLs or
// invent articles, and we get a consistent UI section across all reports.

const { Op } = require("sequelize");
const Articles = require("../../models/articles.models");
const Videos = require("../../models/videos.models");
const Companies = require("../../models/companies.models");

/**
 * Returns a markdown block listing every shortlisted vendor with its logo,
 * name and website, grouped by category. Logos render as inline images in
 * the PDF; sites become clickable links.
 *
 * @param {Array<{categoryId, categoryName, providers: Array<{name, logo, website, productName}>}>} shortlist
 * @param {string} siteUrl - public base URL of the TreasuryMap front (used for "view on TreasuryMap")
 * @returns {string} markdown
 */
function buildVendorDirectory(shortlist, siteUrl) {
  const lines = ["", "## 5. VENDOR DIRECTORY — TOOLS PER CATEGORY", "", ""];
  lines.push(
    "Logos, names and direct links for every vendor referenced in this report. " +
      "All entries are pulled live from the TreasuryMap registry."
  );
  lines.push("");

  let total = 0;
  for (const cat of shortlist) {
    if (!cat.providers || cat.providers.length === 0) continue;
    lines.push(`### ${cat.categoryName}`);
    lines.push("");
    lines.push('<div class="vendor-grid">');
    for (const p of cat.providers) {
      total += 1;
      const safeName = escapeHtml(p.name || "Unnamed");
      const logoTag = p.logo
        ? `<img src="${escapeAttr(p.logo)}" alt="${safeName} logo" />`
        : `<div class="vendor-logo-placeholder">${safeName.slice(0, 3).toUpperCase()}</div>`;
      const productLine =
        p.productName && p.productName !== "N/A" ? `<div class="vendor-product">${escapeHtml(p.productName)}</div>` : "";
      const siteLink =
        p.website && p.website !== "N/A"
          ? `<a class="vendor-site" href="${escapeAttr(normalizeUrl(p.website))}" target="_blank" rel="noopener">Visit site →</a>`
          : "";
      const tmLink = siteUrl
        ? `<a class="vendor-site vendor-site-tm" href="${escapeAttr(siteUrl)}/providers/${slugify(p.name)}" target="_blank" rel="noopener">View on TreasuryMap →</a>`
        : "";
      lines.push(
        `<div class="vendor-card">${logoTag}<div class="vendor-name">${safeName}</div>${productLine}${siteLink}${tmLink}</div>`
      );
    }
    lines.push("</div>");
    lines.push("");
  }

  if (total === 0) {
    // Nothing to show — return empty string so the section is skipped entirely.
    return "";
  }
  return lines.join("\n");
}

/**
 * Returns a markdown block linking back to up to N articles (and videos)
 * from the TreasuryMap content library, prioritising those whose company is
 * in the user's selected categories.
 *
 * @param {number[]} categoryIds
 * @param {string} siteUrl - public base URL of the TreasuryMap front
 * @param {object} [opts]
 * @param {number} [opts.maxArticles=6]
 * @param {number} [opts.maxVideos=3]
 * @returns {Promise<string>} markdown (or empty string if nothing matches)
 */
async function buildFurtherReading(categoryIds, siteUrl, opts = {}) {
  const { maxArticles = 6, maxVideos = 3 } = opts;
  if (!Array.isArray(categoryIds) || categoryIds.length === 0) return "";

  // Find companies in those categories (live, on the map)
  const companies = await Companies.findAll({
    where: {
      companyCategories: { [Op.overlap]: categoryIds },
      live: true,
      multiplayerMap: true,
    },
    attributes: ["id", "name"],
    raw: true,
  });
  if (companies.length === 0) return "";
  const companyById = new Map(companies.map((c) => [c.id, c.name]));
  const companyIds = companies.map((c) => c.id);

  const [articles, videos] = await Promise.all([
    Articles.findAll({
      where: {
        companyId: { [Op.in]: companyIds },
        live: true,
      },
      attributes: ["id", "title", "introduction", "coverImage", "companyId"],
      order: [["id", "DESC"]],
      limit: maxArticles,
      raw: true,
    }).catch(() => []),
    Videos.findAll({
      where: {
        companyId: { [Op.in]: companyIds },
      },
      attributes: ["id", "title", "url", "companyId"],
      order: [["id", "DESC"]],
      limit: maxVideos,
      raw: true,
    }).catch(() => []),
  ]);

  if (articles.length === 0 && videos.length === 0) return "";

  const lines = ["", "## 6. FURTHER READING — FROM THE TREASURYMAP NEWSLETTER", "", ""];
  lines.push(
    "Curated articles and videos from the TreasuryMap content library, " +
      "relevant to the categories you selected. Click through to dive deeper."
  );
  lines.push("");

  if (articles.length) {
    lines.push("### Articles");
    lines.push("");
    lines.push('<div class="reading-list">');
    for (const a of articles) {
      const titleSafe = escapeHtml(a.title || "Untitled");
      const intro = a.introduction
        ? `<div class="reading-intro">${escapeHtml(truncate(a.introduction, 220))}</div>`
        : "";
      const cover = a.coverImage
        ? `<img class="reading-cover" src="${escapeAttr(a.coverImage)}" alt="" />`
        : "";
      const vendorName = companyById.get(a.companyId) || "TreasuryMap";
      const href = siteUrl ? `${siteUrl}/insights/${a.id}` : "#";
      lines.push(
        `<a class="reading-card" href="${escapeAttr(href)}" target="_blank" rel="noopener">` +
          cover +
          `<div class="reading-body"><div class="reading-vendor">${escapeHtml(vendorName)}</div>` +
          `<div class="reading-title">${titleSafe}</div>${intro}</div></a>`
      );
    }
    lines.push("</div>");
    lines.push("");
  }

  if (videos.length) {
    lines.push("### Videos");
    lines.push("");
    lines.push('<ul class="reading-videos">');
    for (const v of videos) {
      const titleSafe = escapeHtml(v.title || "Untitled");
      const vendorName = companyById.get(v.companyId) || "TreasuryMap";
      const href = v.url || "#";
      lines.push(
        `<li><a href="${escapeAttr(href)}" target="_blank" rel="noopener"><strong>${escapeHtml(vendorName)}</strong> — ${titleSafe}</a></li>`
      );
    }
    lines.push("</ul>");
    lines.push("");
  }

  return lines.join("\n");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(str) {
  return escapeHtml(str);
}
function truncate(str, n) {
  const s = String(str || "").trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}
function normalizeUrl(str) {
  const s = String(str || "").trim();
  if (!s) return "#";
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}
function slugify(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  buildVendorDirectory,
  buildFurtherReading,
};

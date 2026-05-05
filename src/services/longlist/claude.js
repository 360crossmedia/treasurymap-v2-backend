const fs = require("fs");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16000;
// Le SDK fait du retry exponentiel par défaut (max_retries=2) sur 429/5xx/connexion.
// On monte à 3 pour absorber les pics de charge Anthropic.
const MAX_RETRIES = 3;
// La génération prend typiquement 4-5 min. On laisse 10 min de marge avant
// d'abandonner (timeout réseau, pas un kill abrupt — le SDK retentera après).
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "prompts/system.txt"),
  "utf8"
);
const USER_TEMPLATE = fs.readFileSync(
  path.join(__dirname, "prompts/user-template.txt"),
  "utf8"
);

let _client = null;
function client() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY manquante dans l'env");
    }
    _client = new Anthropic({ maxRetries: MAX_RETRIES, timeout: REQUEST_TIMEOUT_MS });
  }
  return _client;
}

function formatAnswersBlock(answers) {
  return Object.entries(answers)
    .map(([k, v]) => `- **${k}**: ${Array.isArray(v) ? v.join(", ") : v}`)
    .join("\n");
}

function formatShortlistBlock(grouped) {
  return grouped
    .map((g) => {
      const header = `### ${g.categoryName}`;
      if (!g.providers.length) return `${header}\n*(no providers in TreasuryMap for this category)*`;
      const items = g.providers
        .map((p) => {
          const parts = [`- **${p.name}**`];
          if (p.productName && p.productName !== "N/A") parts.push(`(product: ${p.productName})`);
          if (p.description && p.description !== "N/A") {
            const desc = p.description.length > 400 ? p.description.slice(0, 400) + "…" : p.description;
            parts.push(`— ${desc}`);
          }
          if (p.website && p.website !== "N/A") parts.push(`[${p.website}]`);
          return parts.join(" ");
        })
        .join("\n");
      return `${header}\n${items}`;
    })
    .join("\n\n");
}

function buildUserPrompt({ answers, shortlist }) {
  const monthYear = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  return USER_TEMPLATE.replace("{{MONTH_YEAR}}", monthYear)
    .replace("{{ANSWERS_BLOCK}}", formatAnswersBlock(answers))
    .replace("{{SHORTLIST_BLOCK}}", formatShortlistBlock(shortlist));
}

/**
 * Génère le rapport markdown via Claude Sonnet 4.6.
 *
 * @param {object} input
 * @param {object} input.answers - Les réponses du formulaire { q1: ..., q2: ... }
 * @param {Array}  input.shortlist - Sortie de matching.getProvidersForCategories
 * @returns {Promise<{markdown:string, usage:object, model:string, generationMs:number, stopReason:string}>}
 */
async function generateReport({ answers, shortlist }) {
  const userPrompt = buildUserPrompt({ answers, shortlist });
  const t0 = Date.now();

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const response = await stream.finalMessage();

  const markdown = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!markdown || markdown.length < 500) {
    // Si Claude refuse (stop_reason=refusal) ou produit trop peu, on bloque.
    // L'envoi d'un PDF quasi-vide à un lead serait pire que de marquer failed.
    throw new Error(
      `Sortie Claude trop courte ou vide (${markdown.length} chars, stop_reason=${response.stop_reason})`
    );
  }
  // stop_reason="max_tokens" est toléré : la sortie reste utilisable même
  // tronquée (le rapport est progressif, les premières catégories sont entières).

  return {
    markdown,
    usage: response.usage,
    model: MODEL,
    stopReason: response.stop_reason,
    generationMs: Date.now() - t0,
  };
}

module.exports = { generateReport, buildUserPrompt };

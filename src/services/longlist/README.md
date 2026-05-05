# Long List AI — Module backend

Pipeline de génération de rapports "Long List" personnalisés via Claude API + PDF + email.

## Architecture

```
POST /api/v1/longlist/generate
       │
       ▼
controllers/longlist/index.js  ── valide payload, insert DB, répond 202
       │
       └──► worker.enqueue(reportId)  (setImmediate, non-bloquant)
                  │
                  ▼
           services/longlist/worker.js
                  │
                  ├─► matching.getProvidersForCategories()  ── DB query, filtre placeholders
                  ├─► claude.generateReport()               ── Sonnet 4.6, streaming, ~4-5 min, ~$0.20
                  ├─► pdf.renderPdf()                       ── puppeteer + marked, ~5s
                  └─► email.sendReportEmail()               ── Gmail SMTP OU fallback /tmp en local
                  │
                  ▼
           UPDATE long_list_reports SET status='sent', emailed_at=NOW()
```

## Files

| Fichier | Rôle |
|---|---|
| `controllers/longlist/index.js` | 3 endpoints : `generate`, `status`, `categories` ; validation stricte payload |
| `routes/longlist.routes.js` | Route + rate limit (5/h sur generate, 60/min sur lectures) |
| `models/longlistReports.models.js` | Table `long_list_reports` (Sequelize, sync auto au require) |
| `services/longlist/worker.js` | Orchestre le pipeline, met à jour le statut |
| `services/longlist/matching.js` | Query DB (`companies` overlap `categoryIds`), filtre `live=true ∧ multiplayer_map=true ∧ nom non placeholder` |
| `services/longlist/claude.js` | Construit prompt + appelle Sonnet 4.6, garde sortie vide |
| `services/longlist/prompts/system.txt` | **Prompt système — éditable sans toucher au code** |
| `services/longlist/prompts/user-template.txt` | **Template user prompt avec placeholders** `{{MONTH_YEAR}} {{ANSWERS_BLOCK}} {{SHORTLIST_BLOCK}}` |
| `services/longlist/pdf.js` | Markdown → HTML stylé → PDF A4 (puppeteer + marked) |
| `services/longlist/email.js` | Envoi via transporter Gmail OU fallback fichier local |
| `services/longlist/API.md` | Doc API à destination de l'agent frontend |

## Lancer en local

```bash
# 1. Installer
cd backend && npm install

# 2. Configurer .env
ANTHROPIC_API_KEY=sk-ant-...   # OBLIGATOIRE pour le pipeline réel
G_PASSWORD=<gmail app password> # Optionnel, sinon fallback fichier
DB_NAME=treasurymap_dev
DB_USER=...
DB_HOST=localhost
DB_PORT=5432

# 3. Smoke tests (gratuits, valident l'infra hors Claude)
npm run smoke

# 4. Lancer le serveur (sync DB auto)
npm run dev

# 5. Test E2E réel (consomme ~$0.20 d'API Claude, prend ~5 min)
curl -X POST http://localhost:8000/api/v1/longlist/generate \
  -H 'Content-Type: application/json' \
  -d @scripts/sample-payload.json
# Puis poller : curl http://localhost:8000/api/v1/longlist/status/<id>
```

## Modifier le prompt

C'est la partie la plus susceptible d'être ajustée. **Aucun changement de code requis** :

- `services/longlist/prompts/system.txt` — rôle, format strict, contraintes
- `services/longlist/prompts/user-template.txt` — squelette avec placeholders

Les placeholders du user template sont remplis par `claude.buildUserPrompt()` :
- `{{MONTH_YEAR}}` → "May 2026"
- `{{ANSWERS_BLOCK}}` → bullets `- **{key}**: {value}` issus du `answers` JSONB
- `{{SHORTLIST_BLOCK}}` → providers groupés par catégorie depuis le matching DB

Si tu changes la liste des placeholders, mets aussi à jour `buildUserPrompt()`.

## Changer le modèle Claude

Dans `services/longlist/claude.js` :
```js
const MODEL = "claude-sonnet-4-6";   // ou "claude-opus-4-7" pour + de qualité (5× cher)
const MAX_TOKENS = 16000;             // sortie typique : 12K tokens
```

## Coûts (Sonnet 4.6, ordre de grandeur observé)

| Phase | Volume | Coût |
|---|---|---|
| Input tokens | ~3500 | $0.011 |
| Output tokens | ~12000 | $0.180 |
| **Total / génération** | | **~$0.20** |
| PDF | 4-5 sec puppeteer | gratuit (CPU local) |
| Email Gmail | <1 sec | gratuit (sous quotas Gmail) |

À 1000 générations/mois : ~$200/mois d'API. Augmenter le rate limit (`routes/longlist.routes.js`) avec prudence.

## Note sur le prompt caching

Non implémenté à dessein : le system prompt fait ~1063 tokens, **sous le seuil cacheable de 2048 tokens** sur Sonnet 4.6. Et même si activable, l'output (~$0.18) domine le coût total — le caching n'apporterait que ~3% d'économie. À considérer seulement si le system prompt grossit au-delà de 2K tokens.

## Mode local sans Gmail

Quand `G_PASSWORD=local-dev-noop` (le cas par défaut en dev), l'email n'est PAS envoyé pour de vrai : un `meta.json` + une copie du PDF sont sauvegardés dans `os.tmpdir()/longlist-emails/`. Le statut DB passe quand même à `sent`. Permet de tester le pipeline complet sans config SMTP.

Ouvrir le dernier fallback : `open $(ls -t /var/folders/*/T/longlist-emails/*.pdf | head -1)` (macOS).

## Tests

```bash
npm run smoke   # 28 assertions hors Claude, ~5 sec
```

Pas de tests automatisés du pipeline complet (chaque run = $0.20 + 5 min). Pour valider en CI, utiliser un mock du SDK Anthropic ou stub le `claude.generateReport`.

## Périmètre — fichiers existants touchés

Conformément au handoff, le seul fichier existant modifié est `src/routes/index.js` (1 require + 1 `app.use`) pour brancher `/api/v1/longlist`. Tout le reste est en territoire neuf (`controllers/longlist/`, `services/longlist/`, `models/longlistReports.models.js`, `routes/longlist.routes.js`).

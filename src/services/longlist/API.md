# API — Long List AI

Doc à destination de l'agent frontend qui code le parcours `/get-my-list/`.
Tous les endpoints sont sous `/api/v1/longlist/` et **publics** (pas d'auth requise — décision client tranchée).

Base URL en local : `http://localhost:8000`

---

## 1. `GET /api/v1/longlist/categories`

Récupère la liste des catégories de la TreasuryMap pour alimenter la question 10 du formulaire (cases à cocher).

**Réponse 200**
```json
{
  "categories": [
    { "id": 1,  "name": "FIDP (Financial Instrument Dealing Platform)" },
    { "id": 2,  "name": "FDF (Financial Data Feeding)" },
    { "id": 3,  "name": "CMA (Currency Management Automation)" },
    { "id": 4,  "name": "Integrators" },
    { "id": 5,  "name": "OTS (Other Treasury Solutions)" },
    { "id": 6,  "name": "TRMS (Treasury Risk Management System)" },
    { "id": 7,  "name": "ERP (Enterprise Resource Planning)" },
    { "id": 8,  "name": "Outsourcing" },
    { "id": 9,  "name": "ETL (Extract Transform Load)" },
    { "id": 10, "name": "FSC (Financial Supply Chain)" },
    { "id": 11, "name": "CFF (Cash-Flow Forecasting)" },
    { "id": 12, "name": "eBAM (electronic Bank Account Management)" },
    { "id": 13, "name": "BSG (Bank Single Gateway)" },
    { "id": 14, "name": "TR (Treasury Reporting)" }
  ]
}
```

> Renvoie les 14 catégories DB. À toi de proposer le visuel (cases à cocher + label complet, ou icônes par catégorie, etc.).

---

## 2. `POST /api/v1/longlist/generate`

Soumission du formulaire 10 questions. Lance le pipeline async (matching → Claude → PDF → email). Réponse immédiate (~50ms), génération réelle ~4-5 min côté serveur, PDF envoyé par email à la fin.

**Body JSON**
```json
{
  "email": "user@company.com",                  // OBLIGATOIRE
  "companyName": "Acme Corp",                   // optionnel mais recommandé (apparaît dans le PDF/sujet email)
  "answers": {                                   // OBLIGATOIRE — objet libre, structure libre
    "Company size": "€10B+",
    "Operating regions": "Europe & APAC",
    "ERP": "Microsoft Dynamics",
    "Treasury priorities": ["cash visibility", "FX hedging", "IFRS9"],
    "Existing infrastructure": "TMS legacy à remplacer",
    "Tech preference level": "Balanced",
    "IT strategy": "Best of Breed",
    "Implementation": "With external integrators",
    "Number of banks": "12+",
    "Treasury HQ": "Luxembourg",
    "Retained tools": ["360T", "Bloomberg", "Treasury Spring"]
  },
  "categoryIds": [6, 13, 1, 3, 4, 11, 5]        // OBLIGATOIRE — array des IDs de catégories cochées (vient de l'endpoint 1)
}
```

> **Format `answers`** : volontairement libre (JSONB en DB, repassé tel quel au prompt). Tu choisis les libellés de tes questions, le format des valeurs (string ou array). Garde des libellés explicites en anglais — c'est ce que Claude verra. La langue du rapport est fixée en anglais côté prompt.

**Réponses**

- `202 Accepted` — pipeline démarré
  ```json
  {
    "id": 42,
    "status": "pending",
    "message": "Votre rapport est en cours de génération. Vous le recevrez par email dans quelques minutes."
  }
  ```
- `400 Bad Request` — payload invalide
  ```json
  { "error": "Email invalide ou manquant" }
  ```
  ou
  ```json
  { "error": "Au moins une catégorie doit être sélectionnée" }
  ```
  ou
  ```json
  { "error": "Answers manquant ou invalide" }
  ```

> Côté UX : après le 202, redirige vers une page de confirmation qui affiche l'ID + email + un message « vous recevrez votre rapport par email dans quelques minutes ». Optionnel : tu peux poller l'endpoint 3 si tu veux montrer un statut live, mais pas indispensable car c'est asynchrone.

---

## 3. `GET /api/v1/longlist/status/:id`

Suivi du statut d'un rapport. Optionnel pour le frontend.

**Réponse 200**
```json
{
  "id": 42,
  "status": "pending" | "generating" | "sent" | "failed",
  "emailedAt": "2026-05-05T12:11:03.050Z" | null,
  "errorMessage": "..." | null,
  "createdAt": "2026-05-05T12:06:40.793Z"
}
```

**404** si l'id n'existe pas : `{ "error": "Report introuvable" }`

---

## Notes pratiques

- **CORS** : déjà ouvert sur le backend (`origin: "*"`).
- **Validation email côté front** : utile pour UX, mais le back valide aussi (regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
- **Latence** : le `POST /generate` répond en ~50ms. La génération réelle prend ~4-5 min côté serveur (appel Claude streamé). L'email arrive après. Donc dis bien à l'utilisateur « dans quelques minutes ».
- **Mode local sans Gmail** : en local, `G_PASSWORD=local-dev-noop` → l'email n'est pas vraiment envoyé, il est sauvegardé dans `/tmp/longlist-emails/`. Le statut passe quand même à `sent`. C'est attendu, ça permet de tester le pipeline complet sans config SMTP.

## Suggestions de mapping questions (issu du doc client)

À titre indicatif — tu fais comme tu veux côté UX :

| # | Question | Type | Valeurs suggérées |
|---|---|---|---|
| 1 | Company size | radio | `< €100M`, `€100M-1B`, `€1-10B`, `€10B+` |
| 2 | Operating regions | multi-select | `Europe`, `North America`, `APAC`, `Emerging markets`, `Africa`, `LATAM` |
| 3 | ERP | radio + "other" texte | `SAP`, `Microsoft Dynamics`, `Oracle`, `Sage`, `Workday`, `Other` |
| 4 | Treasury priorities | multi-select | `cash visibility`, `long-term CFF`, `payments automation`, `FX & hedging`, `bank connectivity`, `in-house banking`, `IFRS 9`, `other` |
| 5 | Existing infrastructure | textarea | (libre) |
| 6 | Tech preference level | radio | `Fast (quick wins)`, `Balanced`, `Premium (long implementation)` |
| 7 | IT strategy | radio | `Best of Breed`, `Best of Suite`, `ERP-embedded`, `Mix` |
| 8 | Implementation | radio | `In-house (no integrator)`, `With external integrators` |
| 9 | Number of banks | radio | `1-5`, `6-10`, `11-20`, `20+` |
| 10 | Categories | multi-checkbox | depuis `GET /categories` |

Champs additionnels recommandés (pas dans les 10) :
- **email** (obligatoire)
- **companyName** (optionnel)
- **Treasury HQ** (optionnel) — utile pour le contexte géographique
- **Retained tools** (textarea libre) — important pour que Claude marque "RETAIN" sur les outils déjà en place

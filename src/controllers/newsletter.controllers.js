// Newsletter subscribe — server-side proxy to Zoho Campaigns web-optin.
// Keeps the form fully styled on our domain; Zoho handles the double opt-in
// confirmation email and the Zoho CRM sync (configured in Zoho).
const ZOHO_OPTIN_URL = "https://hlctn-zcmp.maillist-manage.eu/weboptin.zc";

// Hidden fields copied from the Zoho Campaigns embed (the sign-up form for our
// list). Overridable via env if the form is regenerated.
const ZOHO_FIELDS = {
  submitType: "optinCustomView",
  emailReportId: "",
  formType: "QuickForm",
  zx: process.env.ZOHO_ZX || "14ac32dc43",
  zcvers: "2.0",
  oldListIds: "",
  mode: "OptinCreateView",
  zcld: process.env.ZOHO_ZCLD || "1167f174a9723636",
  zctd: process.env.ZOHO_ZCTD || "1167f174a96b8dc1",
  zc_trackCode: "ZCFORMVIEW",
  zc_formIx:
    process.env.ZOHO_FORMIX ||
    "3zc37bd4f459ff54e1b9b84145e093cee8d8c3198c6a3ed642330fd87cd88015cd",
  viewFrom: "URL_ACTION",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const subscribe = async (req, res) => {
  const { email, name } = req.body || {};
  if (!email || typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ ok: false, error: "A valid email is required." });
  }

  const body = new URLSearchParams({
    CONTACT_EMAIL: email.trim(),
    FIRSTNAME: (name || "").toString().trim().slice(0, 80),
    ...ZOHO_FIELDS,
  });

  try {
    const r = await fetch(ZOHO_OPTIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const text = await r.text();

    // Zoho wraps a JSON status in ##ZCJSONSTART##{...}##ZCJSON##
    let zc = null;
    const m = text.match(/##ZCJSONSTART##([\s\S]*?)##ZCJSON##/);
    if (m) {
      try {
        zc = JSON.parse(m[1].replace(/&#34;/g, '"').replace(/&quot;/g, '"'));
      } catch (_) {}
    }

    // An explicit error message from Zoho → surface it.
    if (zc && (zc.status === "error" || zc.errorMsg)) {
      return res.status(400).json({ ok: false, error: zc.errorMsg || "Subscription failed." });
    }
    // spmSubmit / listId present (or just HTTP 200) → accepted; Zoho sends the
    // confirmation email for double opt-in.
    if (r.ok && (zc ? zc.spmSubmit || zc.listId : true)) {
      return res.status(200).json({ ok: true });
    }
    return res.status(502).json({ ok: false, error: "Subscription service unavailable." });
  } catch (e) {
    console.error("Newsletter subscribe failed:", e && e.message);
    return res.status(502).json({ ok: false, error: "Subscription service unavailable." });
  }
};

module.exports = { subscribe };

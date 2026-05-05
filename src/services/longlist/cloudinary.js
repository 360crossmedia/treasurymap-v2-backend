// Upload du PDF généré sur Cloudinary pour persistance long-terme.
// En prod (filesystem éphémère type Railway), c'est essentiel : sans ça le PDF
// disparaît au redémarrage et l'utilisateur n'a plus que la pièce jointe email.
const cloudinary = require("cloudinary").v2;

function isAvailable() {
  const cn = process.env.CLOUD_NAME;
  return cn && cn !== "local-dev-noop";
}

/**
 * Upload un PDF local sur Cloudinary (resource_type: raw).
 * En l'absence de credentials valides, retourne { ok:false, mode:'skipped' }
 * sans throw — le pipeline continue avec le path local.
 *
 * @param {string} localPath - chemin du PDF local
 * @param {object} opts
 * @param {number} opts.reportId
 * @returns {Promise<{ok:boolean, url?:string, mode:'cloudinary'|'skipped'|'failed', error?:string}>}
 */
async function uploadPdf(localPath, { reportId }) {
  if (!isAvailable()) {
    return { ok: false, mode: "skipped" };
  }
  try {
    const result = await cloudinary.uploader.upload(localPath, {
      resource_type: "raw",
      folder: "treasurymap/longlist",
      public_id: `longlist-${reportId}-${Date.now()}`,
      type: "upload",
      // PDF doit être servi avec le bon Content-Type pour s'ouvrir dans le navigateur
      format: "pdf",
    });
    return { ok: true, url: result.secure_url, mode: "cloudinary" };
  } catch (err) {
    return { ok: false, mode: "failed", error: err.message };
  }
}

module.exports = { uploadPdf, isAvailable };

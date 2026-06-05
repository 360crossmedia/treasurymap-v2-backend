const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const Image = require("../models/images.models");

const storage = multer.memoryStorage();
const upload = multer({ storage }).single("file");

const multerUpload = (req, res) =>
  new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) {
        console.error(err);
        return reject(err);
      }
      resolve(req.file);
    });
  });

// Cloudinary is only usable when real credentials are configured. On this
// backend they were placeholders ("local-dev-noop"), which made every upload
// 500. We detect that and fall back to self-hosted DB storage.
const cloudinaryReady = () => {
  const bad = (v) => !v || v === "local-dev-noop";
  return (
    !bad(process.env.CLOUD_NAME) &&
    !bad(process.env.API_KEY) &&
    !bad(process.env.API_SECRET)
  );
};

const uploadToCloudinary = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, resource_type: "auto" },
      (error, result) => (error ? reject(error) : resolve(result.secure_url))
    );
    require("stream").PassThrough().end(buffer).pipe(stream);
  });

const uploadImage = async (req, res) => {
  try {
    const file = await multerUpload(req, res);
    if (!file || !file.buffer) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    // 1) Use Cloudinary when it's actually configured.
    if (cloudinaryReady()) {
      try {
        const url = await uploadToCloudinary(
          file.buffer,
          uuidv4() + "-" + file.originalname
        );
        return res.status(200).json(url);
      } catch (e) {
        console.error("Cloudinary upload failed, falling back to DB:", e);
      }
    }

    // 2) Fallback: store in our own DB, serve via GET /api/v1/images/:id.
    const img = await Image.create({
      data: file.buffer.toString("base64"),
      mime: file.mimetype || "image/png",
    });
    const base = `${req.protocol}://${req.get("host")}`;
    return res.status(200).json(`${base}/api/v1/images/${img.id}`);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ success: false, error: "Error interno del servidor" });
  }
};

// Serve a self-hosted image. Public (no auth) · it's just an image URL used in
// <img src>. Long cache since rows are immutable once created.
const getImage = async (req, res) => {
  try {
    const img = await Image.findByPk(req.params.id);
    if (!img || !img.data) return res.status(404).send("Not found");
    const buf = Buffer.from(img.data, "base64");
    res.set("Content-Type", img.mime || "image/png");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(buf);
  } catch (error) {
    console.error(error);
    return res.status(500).send("error");
  }
};

module.exports = { uploadImage, getImage };

const db = require("../utils/database");
const { DataTypes } = require("sequelize");

// Self-hosted image store. Used as a fallback for logo/cover uploads when
// Cloudinary is not configured. The binary is kept as base64 in `data` and
// served back via GET /api/v1/images/:id, so the company `logo` column stays
// a short URL (no payload bloat on the map).
const Image = db.define("image", {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
  },
  data: { type: DataTypes.TEXT }, // base64-encoded bytes (Postgres TEXT = unlimited)
  mime: { type: DataTypes.STRING },
});

module.exports = Image;

const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const LongListReports = db.define(
  "long_list_reports",
  {
    id: {
      primaryKey: true,
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    companyName: {
      type: DataTypes.STRING,
      field: "company_name",
    },
    answers: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    categoryIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: "category_ids",
      defaultValue: [],
    },
    // Type de rapport : "longlist" (parcours classique, 10 questions) ou
    // "comparison" (Compare Tools : 2-5 vendors d'une même catégorie).
    reportType: {
      type: DataTypes.ENUM("longlist", "comparison"),
      field: "report_type",
      defaultValue: "longlist",
      allowNull: false,
    },
    // Pour les comparisons : ids des vendors comparés (subset de la catégorie).
    vendorIds: {
      type: DataTypes.ARRAY(DataTypes.INTEGER),
      field: "vendor_ids",
      defaultValue: [],
    },
    status: {
      type: DataTypes.ENUM("pending", "generating", "sent", "failed"),
      defaultValue: "pending",
      allowNull: false,
    },
    reportMd: {
      type: DataTypes.TEXT,
      field: "report_md",
    },
    pdfPath: {
      type: DataTypes.STRING,
      field: "pdf_path",
    },
    // The rendered PDF kept in the DB (base64). Guarantees the download endpoint
    // works even on ephemeral filesystems (Railway) and without Cloudinary.
    pdfData: {
      type: DataTypes.TEXT,
      field: "pdf_data",
    },
    errorMessage: {
      type: DataTypes.TEXT,
      field: "error_message",
    },
    modelUsed: {
      type: DataTypes.STRING,
      field: "model_used",
    },
    inputTokens: {
      type: DataTypes.INTEGER,
      field: "input_tokens",
    },
    outputTokens: {
      type: DataTypes.INTEGER,
      field: "output_tokens",
    },
    generationMs: {
      type: DataTypes.INTEGER,
      field: "generation_ms",
    },
    emailedAt: {
      type: DataTypes.DATE,
      field: "emailed_at",
    },
  },
  {
    tableName: "long_list_reports",
  }
);

LongListReports.sync({ alter: true })
  .then(() => console.log("long_list_reports table synced"))
  .catch((err) => console.error("long_list_reports sync error:", err.message));

module.exports = LongListReports;

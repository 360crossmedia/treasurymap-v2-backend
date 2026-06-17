const db = require("../utils/database");
const { DataTypes } = require("sequelize");

// Lightweight "started but not (yet) completed" Build-my-shortlist leads. The
// email is captured as soon as the visitor types a valid one, so an abandoned
// questionnaire still leaves a contactable lead instead of nothing. A completed
// submission creates a full long_list_reports row; the admin view merges the two
// and drops partials whose email already has a full report.
const ShortlistLeads = db.define(
  "shortlist_leads",
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
  },
  {
    tableName: "shortlist_leads",
  }
);

ShortlistLeads.sync({ alter: true })
  .then(() => console.log("shortlist_leads table synced"))
  .catch((err) => console.error("shortlist_leads sync error:", err.message));

module.exports = ShortlistLeads;

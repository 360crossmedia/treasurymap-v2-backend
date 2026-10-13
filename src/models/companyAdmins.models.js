const db = require("../utils/database");
const { DataTypes } = require("sequelize");

// Join table: extra admins for a company, on top of its single primary owner
// (companies.user_id). A user listed here may edit that company exactly like
// the owner. Lets a vendor have several people managing one listing. The table
// is auto-created by db.sync({ alter: true }) on boot.
const CompanyAdmins = db.define(
  "company_admins",
  {
    id: {
      primaryKey: true,
      type: DataTypes.INTEGER,
      autoIncrement: true,
      allowNull: false,
    },
    companyId: {
      type: DataTypes.INTEGER,
      field: "company_id",
      allowNull: false,
      references: { model: "companies", key: "id" },
    },
    userId: {
      type: DataTypes.INTEGER,
      field: "user_id",
      allowNull: false,
      references: { model: "users", key: "id" },
    },
  },
  {
    indexes: [{ unique: true, fields: ["company_id", "user_id"] }],
  }
);

module.exports = CompanyAdmins;

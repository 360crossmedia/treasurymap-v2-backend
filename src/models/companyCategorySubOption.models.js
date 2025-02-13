const { DataTypes } = require("sequelize");
const db = require("../utils/database");
const Companies = require("./companies.models");

const CompanyCategorySubOption = db.define(
  "company_category_sub_option",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    companyId: {
      type: DataTypes.INTEGER,
      field: "company_id",
      allowNull: false,
      references: {
        model: "companies",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    categoryId: {
      type: DataTypes.INTEGER,
      field: "category_id",
      allowNull: false,
      references: {
        model: "categories",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    subOptionId: {
      type: DataTypes.INTEGER,
      field: "sub_option_id",
      allowNull: true,
      references: {
        model: "sub_options",
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    tableName: "company_category_sub_option",
    indexes: [
      {
        unique: true,
        fields: ["company_id", "category_id"],
      },
    ],
  }
);

module.exports = CompanyCategorySubOption;

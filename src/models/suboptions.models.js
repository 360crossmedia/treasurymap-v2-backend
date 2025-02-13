const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const CompanyCategorySubOption = require("./companyCategorySubOption");

const SubOptions = db.define("sub_options", {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    field: "name",
    allowNull: false,
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
});

module.exports = SubOptions;

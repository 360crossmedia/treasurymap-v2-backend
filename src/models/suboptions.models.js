const db = require("../utils/database");
const { DataTypes } = require("sequelize");

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
  isSelected: {
    type: DataTypes.BOOLEAN,
    field: "is_selected",
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

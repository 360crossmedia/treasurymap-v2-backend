const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const Articles = db.define("articles", {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  introduction: {
    type: DataTypes.STRING(500),
  },
  coverImage: {
    type: DataTypes.STRING,
    field: "cover_image",
  },
  live: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
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
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
  },
});

module.exports = Articles;

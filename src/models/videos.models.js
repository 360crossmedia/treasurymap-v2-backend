const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const Videos = db.define("videos", {
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
  url: {
    type: DataTypes.STRING,
    allowNull: false,
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
  introduction: {
    type: DataTypes.STRING(800),
  },
  // Rich HTML description (Quill), like articles. Lets a video have a formatted
  // description (line breaks, bold, lists) instead of the plain introduction.
  body: {
    type: DataTypes.TEXT,
  },
  coverImage: {
    type: DataTypes.STRING,
    field: "cover_image",
  },
  live: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
  },
});

module.exports = Videos;

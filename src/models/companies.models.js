const db = require("../utils/database");
const { DataTypes } = require("sequelize");
const CompanyCategorySubOption = require("./companyCategorySubOption");

const Companies = db.define("companies", {
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
    unique: false,
  },
  description: {
    type: DataTypes.STRING(6000),
    field: "description",
  },
  creationDate: {
    type: DataTypes.STRING,
    field: "creation_date",
  },
  turnover: {
    type: DataTypes.BIGINT,
  },
  employees: {
    type: DataTypes.STRING,
  },
  location: {
    type: DataTypes.STRING,
  },
  userId: {
    type: DataTypes.INTEGER,
    field: "user_id",
    allowNull: false,
    references: {
      model: "users",
      key: "id",
    },
  },
  companyWebsite: {
    type: DataTypes.STRING,
    field: "company_website",
  },
  companyOffices: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    field: "company_offices",
  },
  companyCategories: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    field: "company_categories",
  },
  companySubcategories: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
    field: "company_subcategories",
  },
  productName: {
    type: DataTypes.STRING,
    field: "product_name",
  },
  productVersion: {
    type: DataTypes.STRING(6000),
    field: "product_version",
  },
  logo: {
    type: DataTypes.STRING,
  },
  keywords: {
    type: DataTypes.ARRAY(DataTypes.STRING),
  },
  live: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  maincategory: {
    type: DataTypes.ARRAY(DataTypes.INTEGER),
  },
  showTurnover: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: "show_turnover",
  },
  multiplayerMap: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: "multiplayer_map",
  },
});

Companies.hasMany(CompanyCategorySubOption, {
  foreignKey: "categoryId",
  sourceKey: "id",
});

module.exports = Companies;

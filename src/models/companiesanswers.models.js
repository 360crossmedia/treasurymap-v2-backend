const db = require("../utils/database");
const { DataTypes } = require("sequelize");

const CompaniesAnswers = db.define("companies_answers", {
  id: {
    primaryKey: true,
    type: DataTypes.INTEGER,
    autoIncrement: true,
    allowNull: false,
  },
  answer: {
    type: DataTypes.STRING(1000),
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
  questionId: {
    type: DataTypes.INTEGER,
    field: "question_id",
    allowNull: false,
    references: {
      model: "questions",
      key: "id",
    },
  },
});

module.exports = CompaniesAnswers;

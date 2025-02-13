const Users = require("./user.models");
const Companies = require("./companies.models");
const Categories = require("./categories.models");
const SubCategories = require("./subcategories.models");
const Questions = require("./questions.models");
const CompaniesAnswers = require("./companiesanswers.models");
const Countries = require("./countries.models");
const Videos = require("./videos.models");
const Articles = require("./articles.models");
const MainPublication = require("./mainpublication.models");
const SubOptions = require("./suboptions.models");
const CompanyCategorySubOption = require("./CompanyCategorySubOption");

const initModels = () => {
  Users;
  Companies;
  Categories;
  SubCategories;
  Questions;
  CompaniesAnswers;
  Countries;
  Videos;
  Articles;
  MainPublication;
  SubOptions;
  CompanyCategorySubOption;
};

module.exports = initModels;

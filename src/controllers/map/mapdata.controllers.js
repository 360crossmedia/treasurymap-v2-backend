const CompaniesServices = require("../../services/companies.service.js");
const template = require("../../services/map/categoriesTemplateMP.js");
const { processCategories } = require("../../services/map/mapdata.services.js");

const getMapData = async (req, res) => {
  try {
    const categoriesData = await processCategories();
    res.status(200).json(categoriesData);
  } catch (error) {
    console.error("Error in /data route:", error);
    res.status(500).send("Internal Server Error");
  }
};

const getMultiplayerMapData = async (req, res, next) => {
  try {
    const companies =
      await CompaniesServices.getAllCompaniesWithMultiplayerMapAndLive();
    const categories = JSON.parse(JSON.stringify(template));

    companies.forEach((company) => {
      for (let i = 1; i <= 15; i++) {
        company.companyCategories.forEach((companyCategory) => {
          if (
            companyCategory === i &&
            !categories[`category-${i}`].find((cat) => cat.id === company.id)
          ) {
            categories[`category-${i}`].push({
              id: company.id,
              live: company.live,
              logo: company.logo || "",
              name: company.name || "",
            });
          }
        });
      }
    });

    res.status(200).json(categories);
  } catch (error) {
    next(error);
  }
};

module.exports = { getMapData, getMultiplayerMapData };

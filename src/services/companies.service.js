const Companies = require("../models/companies.models");
const Articles = require("../models/articles.models");
const Videos = require("../models/videos.models");

class CompaniesServices {
  static async getOwnedService(userId) {
    try {
      const companiesOwned = await Companies.findAll({
        where: {
          userId: userId,
        },
      });
      if (companiesOwned.length) {
        return companiesOwned;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }

  static async getAllCompaniesServices() {
    try {
      const companies = await Companies.findAll();
      if (companies.length) {
        const sortedCompanies = companies.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        return sortedCompanies;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }

  static async createCompanyService(data) {
    try {
      const company = await Companies.create(data);
      if (company) {
        return company;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }

  static async getCompanyDataService(companyId) {
    try {
      const company = await Companies.findOne({
        where: { id: companyId },
      });
      return company;
    } catch (error) {
      throw error;
    }
  }

  static async updateCompanyDataService(companyId, updatedData, fields) {
    try {
      const previusValue = await Companies.findOne({
        where: { id: companyId },
      });
      const options = { where: { id: companyId } };
      // When a whitelist is provided, Sequelize only writes those attributes,
      // so unknown/forbidden keys (id, timestamps, junk) are ignored even if
      // present in the body.
      if (Array.isArray(fields) && fields.length) options.fields = fields;
      const company = await Companies.update(updatedData, options);
      if (company) return previusValue;
    } catch (error) {
      throw error;
    }
  }

  static async deleteCompany(companyId) {
    try {
      const company = await Companies.destroy({
        where: {
          id: companyId,
        },
      });
      return company;
    } catch (error) {
      throw error;
    }
  }

  static async getCompaniesByMainCategoryId(id) {
    try {
      const companies = await Companies.findAll({
        where: {
          maincategory: [id],
        },
      });
      return companies;
    } catch (error) {
      throw error;
    }
  }

  static async getAllCompaniesWithMultiplayerMapAndLive() {
    try {
      const companies = await Companies.findAll({
        where: {
          multiplayerMap: true,
          live: true,
        },
        attributes: ["companyCategories", "id", "logo", "name", "live"],
      });
      return companies;
    } catch (error) {
      throw error;
    }
  }

  static async hasRelatedContent(companyId) {
    try {
      // Verifica si hay artículos relacionados
      const articlesCount = await Articles.count({
        where: { companyId },
      });

      // Verifica si hay videos relacionados
      const videosCount = await Videos.count({
        where: { companyId },
      });

      // Si tiene artículos o videos, retorna true
      return articlesCount > 0 || videosCount > 0;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = CompaniesServices;

const Companies = require("../models/companies.models");
const Articles = require("../models/articles.models");
const Videos = require("../models/videos.models");
const CompanyAdmins = require("../models/companyAdmins.models");

class CompaniesServices {
  // Companies a user may manage: the ones they primarily own (companies.user_id)
  // PLUS the ones they are a linked admin of (company_admins). Deduplicated.
  static async getOwnedService(userId) {
    try {
      const owned = await Companies.findAll({ where: { userId } });
      const links = await CompanyAdmins.findAll({ where: { userId } });
      const ownedIds = new Set(owned.map((c) => c.id));
      const extraIds = links
        .map((l) => l.companyId)
        .filter((id) => !ownedIds.has(id));
      const extra = extraIds.length
        ? await Companies.findAll({ where: { id: extraIds } })
        : [];
      const all = [...owned, ...extra];
      return all.length ? all : false;
    } catch (error) {
      throw error;
    }
  }

  // True if the user is the owner OR a linked admin of the company.
  static async canUserEditCompany(companyId, userId) {
    try {
      const company = await Companies.findByPk(companyId);
      if (!company) return false;
      if (Number(company.userId) === Number(userId)) return true;
      const link = await CompanyAdmins.findOne({
        where: { companyId, userId },
      });
      return !!link;
    } catch (error) {
      throw error;
    }
  }

  // The extra admin user ids linked to a company (never includes the owner).
  static async listAdminUserIds(companyId) {
    try {
      const links = await CompanyAdmins.findAll({ where: { companyId } });
      return links.map((l) => l.userId);
    } catch (error) {
      throw error;
    }
  }

  // Link a user as an extra admin (idempotent: no duplicate rows).
  static async addAdminLink(companyId, userId) {
    try {
      const [link] = await CompanyAdmins.findOrCreate({
        where: { companyId, userId },
        defaults: { companyId, userId },
      });
      return link;
    } catch (error) {
      throw error;
    }
  }

  // Remove an extra-admin link. Returns the number of rows deleted (0 if none).
  static async removeAdminLink(companyId, userId) {
    try {
      return await CompanyAdmins.destroy({ where: { companyId, userId } });
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

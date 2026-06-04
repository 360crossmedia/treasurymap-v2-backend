const Articles = require("../models/articles.models");

class ArticlesServices {
  static async createArticleService(articleData) {
    try {
      const article = await Articles.create(articleData);
      return article;
    } catch (error) {
      throw error;
    }
  }

  static async GetAllArticlesService() {
    try {
      return await Articles.findAll({ order: [["createdAt", "DESC"]] });
    } catch (error) {
      throw error;
    }
  }

  static async GetArticleByCompanyIdService(companyId) {
    try {
      const ArticlesList = await Articles.findAll({
        where: {
          companyId: companyId,
        },
      });
      if (ArticlesList) {
        return ArticlesList;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }

  static async DeleteArticleService(articleid) {
    try {
      const article = await Articles.destroy({
        where: {
          id: articleid,
        },
      });
      if (article) {
        return article;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }
  static async GetArticleByIdService(articleid) {
    try {
      const result = await Articles.findByPk(articleid);
      return result;
    } catch (error) {
      throw error;
    }
  }
  static async UpdateArticleService(articleId, articleData) {
    try {
      const result = await Articles.update(articleData, {
        where: { id: articleId },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ArticlesServices;

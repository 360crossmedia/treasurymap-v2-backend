const Articles = require("../models/articles.models");
const MainPublication = require("../models/mainpublication.models");
const Videos = require("../models/videos.models");

class MainPublicationServices {
  static async updateMainPublication(mainPublicationId, mainPublicationData) {
    try {
      const result = await MainPublication.update(mainPublicationData, {
        where: { id: mainPublicationId },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
  static async getMainPublication() {
    try {
      // Obtener todas las publicaciones principales
      const mainPublications = await MainPublication.findAll({
        order: [["id", "ASC"]],
      });

      // Obtener las IDs de los artículos y videos
      const articleIds = mainPublications
        .filter((pub) => pub.isArticle)
        .map((pub) => pub.publicationId);
      const videoIds = mainPublications
        .filter((pub) => !pub.isArticle)
        .map((pub) => pub.publicationId);

      // Obtener solo los campos id y title de los artículos y videos
      const articles = await Articles.findAll({
        where: { id: articleIds },
        attributes: ["id", "title"],
      });

      const videos = await Videos.findAll({
        where: { id: videoIds },
        attributes: ["id", "title", "url"],
      });

      // Preserve slot POSITION: index i maps to slot id i+1 in the admin UI, so
      // empty / dangling slots must stay as null (NOT be dropped). Filtering them
      // out shortened the array and made reorder/feature writes hit the wrong
      // slot. The admin UI already guards each entry with `m && m.id != null`.
      return mainPublications.map((pub) => {
        const found = pub.isArticle
          ? articles.find((article) => article.id === pub.publicationId)
          : videos.find((video) => video.id === pub.publicationId);
        return found || null;
      });
    } catch (error) {
      throw error;
    }
  }
  static async getFullMainPublication() {
    try {
      // Obtener todas las publicaciones principales
      const mainPublications = await MainPublication.findAll({
        order: [["id", "ASC"]],
      });

      // Obtener las IDs de los artículos y videos
      const articleIds = mainPublications
        .filter((pub) => pub.isArticle)
        .map((pub) => pub.publicationId);
      const videoIds = mainPublications
        .filter((pub) => !pub.isArticle)
        .map((pub) => pub.publicationId);

      // Obtener solo los campos id y title de los artículos y videos
      const articles = await Articles.findAll({
        where: { id: articleIds },
      });

      const videos = await Videos.findAll({
        where: { id: videoIds },
      });

      // Combinar y ordenar los resultados
      const result = mainPublications.map((pub) => {
        if (pub.isArticle) {
          return articles.find((article) => article.id === pub.publicationId);
        } else {
          return videos.find((video) => video.id === pub.publicationId);
        }
      });

      // Filtrar los resultados para asegurarse de que no haya elementos undefined
      const filteredResult = result.filter((item) => item !== undefined);

      return filteredResult;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = MainPublicationServices;

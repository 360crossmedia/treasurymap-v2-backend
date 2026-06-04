const Videos = require("../models/videos.models");

class VideosServices {
  static async createVideoService(videoData) {
    try {
      const video = await Videos.create(videoData);
      return video;
    } catch (error) {
      throw error;
    }
  }

  static async GetAllVideosService() {
    try {
      return await Videos.findAll({ order: [["createdAt", "DESC"]] });
    } catch (error) {
      throw error;
    }
  }

  static async GetVideoByCompanyIdService(companyId) {
    try {
      const VideosList = await Videos.findAll({
        where: {
          companyId: companyId,
        },
      });
      if (VideosList) {
        return VideosList;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }

  static async DeleteVideoService(videoid) {
    try {
      const video = await Videos.destroy({
        where: {
          id: videoid,
        },
      });
      if (video) {
        return video;
      } else {
        return false;
      }
    } catch (error) {
      throw error;
    }
  }
  static async GetVideoByIdService(videoId) {
    try {
      const result = await Videos.findByPk(videoId);
      return result;
    } catch (error) {
      throw error;
    }
  }
  static async UpdateVideoService(videoId, videoData) {
    try {
      const result = await Videos.update(videoData, {
        where: { id: videoId },
      });
      return result;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = VideosServices;

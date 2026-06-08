const VideosServices = require("../services/videos.services");

const CreateVideo = async (req, res, next) => {
  try {
    const { companyId } = req.params;
    const videoData = req.body;
    videoData.companyId = companyId;
    const result = await VideosServices.createVideoService(videoData);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

const GetAllVideos = async (req, res) => {
  try {
    const result = await VideosServices.GetAllVideosService();
    // Public callers only see published (live) videos; admin sees all drafts.
    const isAdmin = Number(req.user && req.user.id) === 1;
    const list =
      isAdmin || !Array.isArray(result) ? result : result.filter((v) => v.live);
    res.status(200).json(list);
  } catch (error) {
    res.status(400).json(error);
  }
};

const GetVideoByCompanyId = async (req, res) => {
  try {
    const { companyId } = req.params;

    const result = await VideosServices.GetVideoByCompanyIdService(companyId);

    if (result) {
      res.status(200).json(result);
    } else if (!result) {
      res.status(400).json({ message: "Error Controller response" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
};

const DeleteVideo = async (req, res) => {
  try {
    const { videoid } = req.params;

    const result = await VideosServices.DeleteVideoService(videoid);

    if (result) {
      res.status(200).json(result);
    } else if (!result) {
      res
        .status(400)
        .json({ message: "Video does not exist. Controller response" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json(error);
  }
};

const getVideoById = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const result = await VideosServices.GetVideoByIdService(videoId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const updateVideo = async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const videoData = req.body;
    const result = await VideosServices.UpdateVideoService(videoId, videoData);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  CreateVideo,
  GetAllVideos,
  GetVideoByCompanyId,
  DeleteVideo,
  getVideoById,
  updateVideo,
};

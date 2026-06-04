const { Router } = require("express");
const router = Router();
const {
  CreateVideo,
  GetAllVideos,
  GetVideoByCompanyId,
  DeleteVideo,
  getVideoById,
  updateVideo,
} = require("../controllers/videos.controllers");

router.get("/", GetAllVideos);
router.get("/all/:companyId", GetVideoByCompanyId);
router.get("/:videoId", getVideoById);
router.post("/create/:companyId", CreateVideo);
router.put("/:videoId", updateVideo);
router.delete("/:videoid", DeleteVideo);

module.exports = router;

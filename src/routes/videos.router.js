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
const { requireAuth } = require("../middlewares/auth.middleware");
const {
  ownsCompanyByParam,
  ownsVideo,
} = require("../middlewares/ownership.middleware");

router.get("/", GetAllVideos);
router.get("/all/:companyId", GetVideoByCompanyId);
router.get("/:videoId", getVideoById);
router.post("/create/:companyId", requireAuth, ownsCompanyByParam("companyId"), CreateVideo);
router.put("/:videoId", requireAuth, ownsVideo, updateVideo);
router.delete("/:videoid", requireAuth, ownsVideo, DeleteVideo);

module.exports = router;

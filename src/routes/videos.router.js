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

router.get("/", GetAllVideos);
router.get("/all/:companyId", GetVideoByCompanyId);
router.get("/:videoId", getVideoById);
router.post("/create/:companyId", requireAuth, CreateVideo);
router.put("/:videoId", requireAuth, updateVideo);
router.delete("/:videoid", requireAuth, DeleteVideo);

module.exports = router;

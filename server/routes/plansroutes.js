const express = require('express');
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { addPlan, getPlans, getPlanById, updatePlan, deletePlan, togglePlanStatus, expirePlan } = require('../controller/membership');
const userauth = require('../middleware/userauth.js');
const tenantBinder = require('../middleware/tenantBinder.js');

const Router = express.Router();

// Multer for plan images
const planStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/plans/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      "plan-" +
      uniqueSuffix +
      path.extname(file.originalname).toLowerCase()
    );
  },
});

const planUpload = multer({
  storage: planStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files allowed"));
    }
  },
});

// Plan routes (direct access without /gym prefix)
Router.post("/add", userauth, planUpload.single("image"), tenantBinder, addPlan);
Router.get("/", userauth, getPlans); // ?status=Active&type=Monthly&search=gold&page=1&limit=10
Router.get("/:id", userauth, getPlanById);
Router.put("/:id", userauth, planUpload.single("image"), tenantBinder, updatePlan);
Router.delete("/:id", userauth, deletePlan);
Router.patch("/:id/toggle", userauth, togglePlanStatus);
Router.patch("/:id/expire", userauth, expirePlan);

// Test endpoint to verify plans routes are working
Router.get("/test", (req, res) => {
  console.log('Plans test endpoint called');
  res.json({ success: true, message: "Plans routes are working" });
});

module.exports = Router;
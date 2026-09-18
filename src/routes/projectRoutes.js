const express = require("express");

const {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject
} = require("../controllers/projectController");

const auth = require("../middleware/auth");

const router = express.Router();

router.post("/projects", auth, createProject);

router.get("/projects", auth, getProjects);
router.get("/projects/:id", auth, getProjectById);
router.put("/projects/:id", auth, updateProject);
router.delete("/projects/:id", auth, deleteProject);

module.exports = router;
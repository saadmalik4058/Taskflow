const express = require("express");

const {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject
} = require("../controllers/projectController");

const auth = require("../middleware/auth");
const { validateBody, validateParams } = require("../middleware/validate");
const {
    createProjectSchema,
    updateProjectSchema,
    projectParamsSchema
} = require("../validators/projectValidators");

const router = express.Router();

router.post("/projects", auth, validateBody(createProjectSchema), createProject);

router.get("/projects", auth, getProjects);
router.get("/projects/:id", auth, validateParams(projectParamsSchema), getProjectById);
router.put("/projects/:id", auth, validateParams(projectParamsSchema), validateBody(updateProjectSchema), updateProject);
router.delete("/projects/:id", auth, validateParams(projectParamsSchema), deleteProject);

module.exports = router;
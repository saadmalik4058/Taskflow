const Project = require("../models/Project");

// NOTE: No try/catch here. Express 5 forwards any error thrown in these
// async handlers to src/middleware/errorHandler.js.

const createProject = async (req, res) => {
    // Zod already guaranteed that name exists and is not empty.
    const { name, description } = req.body;

    const project = await Project.create({
        name,
        description,
        createdBy: req.user.id
    });

    res.status(201).json({
        message: "Project created successfully",
        project
    });
};

const getProjects = async (req, res) => {
    const projects = await Project.find({
        createdBy: req.user.id
    });

    res.status(200).json({
        projects
    });
};

const getProjectById = async (req, res) => {
    // Zod already guaranteed that req.params.id is a valid MongoDB ID,
    // so findById cannot throw a CastError here.
    const project = await Project.findById(req.params.id);

    if (!project) {
        return res.status(404).json({
            message: "Project not found"
        });
    }

    if (project.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
            message: "You are not allowed to view this project"
        });
    }

    res.status(200).json({
        project
    });
};

const updateProject = async (req, res) => {
    const { name, description } = req.body;

    const project = await Project.findById(req.params.id);

    if (!project) {
        return res.status(404).json({
            message: "Project not found"
        });
    }

    if (project.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
            message: "You are not allowed to update this project"
        });
    }

    // Zod strips unknown fields, so a client cannot change "createdBy"
    // here. Fields the client did not send are undefined and are skipped.
    if (name !== undefined) {
        project.name = name;
    }

    if (description !== undefined) {
        project.description = description;
    }

    const updatedProject = await project.save();

    res.status(200).json({
        message: "Project updated successfully",
        project: updatedProject
    });
};

const deleteProject = async (req, res) => {
    const project = await Project.findById(req.params.id);

    if (!project) {
        return res.status(404).json({
            message: "Project not found"
        });
    }

    if (project.createdBy.toString() !== req.user.id) {
        return res.status(403).json({
            message: "You are not allowed to delete this project"
        });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.status(200).json({
        message: "Project deleted successfully",
        project
    });
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject
};

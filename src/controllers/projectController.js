const Project = require("../models/Project");

const createProject = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({
                message: "Project name is required"
            });
        }

        const project = await Project.create({
            name,
            description,
            createdBy: req.user.id
        });

        res.status(201).json({
            message: "Project created successfully",
            project
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to create project",
            error: error.message
        });
    }
};

const getProjects = async (req, res) => {
    try {
        const projects = await Project.find({
            createdBy: req.user.id
        });

        res.status(200).json({
            projects
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to get projects",
            error: error.message
        });
    }
};

const getProjectById = async (req, res) => {
    try {
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

    } catch (error) {
        res.status(500).json({
            message: "Failed to get project",
            error: error.message
        });
    }
};

const updateProject = async (req, res) => {
    try {
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

    } catch (error) {
        res.status(500).json({
            message: "Failed to update project",
            error: error.message
        });
    }
};

const deleteProject = async (req, res) => {
    try {
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

    } catch (error) {
        res.status(500).json({
            message: "Failed to delete project",
            error: error.message
        });
    }
};

module.exports = {
    createProject,
    getProjects,    
    getProjectById,
    updateProject,
    deleteProject
};      
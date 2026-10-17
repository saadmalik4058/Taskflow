const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

// Index for the main project listing: getProjects filters by createdBy.
projectSchema.index({ createdBy: 1 });

const Project = mongoose.model("Project", projectSchema);

module.exports = Project;
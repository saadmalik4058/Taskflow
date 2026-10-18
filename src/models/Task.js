const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true
        },

        status: {
            type: String,
            enum: ["pending", "in-progress", "completed"],
            default: "pending"
        },

        priority: {
            type: String,
            enum: ["low", "medium", "high"],
            default: "medium"
        },

        dueDate: {
            type: Date
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);

// ---------------------------------------------------------------------
// INDEXES
//
// Without an index, MongoDB must read EVERY document in the collection
// (a "collection scan") and then sort the matches in memory. That is fine
// with 50 tasks and painful with 50,000.
//
// A compound index is like a phone book sorted by last name and then
// first name. The FIELD ORDER matters, and the rule of thumb is ESR:
//   Equality fields first, then the Sort field, then Range fields.
//
// WHY IS _id IN EVERY INDEX?
// getTasks sorts by { createdAt: X, _id: X } so that pagination is stable
// when two tasks share the same timestamp. If the index only covered
// createdAt, MongoDB could not prove the full sort order was satisfied,
// so it had to read ALL matching documents and sort them in memory.
//
// Measured on 24,000 tasks (see the explain() figures):
//   no index                -> SORT,   24,000 docs read, ~46ms
//   index without _id       -> SORT,    2,000 docs read, ~12ms
//   index with _id          -> LIMIT,      10 docs read,  ~3ms
//
// The _id lets MongoDB walk the index and stop as soon as it has enough
// rows, instead of loading everything first.
//
// MongoDB uses at most ONE index per query, so these four cover the real
// query shapes instead of one index trying to do everything.
//
// A -1 (descending) index also serves an ascending (+1) query: MongoDB
// simply traverses the same index backwards.
// ---------------------------------------------------------------------

// Default task listing: filter by owner, sort by newest.
taskSchema.index({ createdBy: 1, createdAt: -1, _id: -1 });

// Same, when the client filters by status.
taskSchema.index({ createdBy: 1, status: 1, createdAt: -1, _id: -1 });

// Same, when the client filters by priority.
taskSchema.index({ createdBy: 1, priority: 1, createdAt: -1, _id: -1 });

// ---------------------------------------------------------------------
// ASSIGNMENT
//
// getTasks with scope=assigned filters by assignedTo instead of createdBy,
// so it needs its own indexes for exactly the same reason: without them,
// "tasks assigned to me" would read every task in the collection and sort
// the matches in memory, even though the client only asked for 10.
//
// Note that assignedTo CAN be missing on a task. MongoDB indexes treat a
// missing field as null, and we always query a concrete user id, so those
// documents simply never match.
// ---------------------------------------------------------------------

// "Tasks assigned to me", newest first.
taskSchema.index({ assignedTo: 1, createdAt: -1, _id: -1 });

// Same, when the assignee also filters by status.
taskSchema.index({ assignedTo: 1, status: 1, createdAt: -1, _id: -1 });

// Supports "all tasks of one project" and makes the cascade delete in
// deleteProject (Task.deleteMany({ project })) an indexed lookup.
taskSchema.index({ project: 1 });

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
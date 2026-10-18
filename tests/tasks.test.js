const mongoose = require("mongoose");

const {
    app,
    request,
    authHeader,
    registerAndLogin,
    createProject,
    createTask
} = require("./helpers");

const randomId = () => new mongoose.Types.ObjectId().toString();

// Convenience: create a logged-in user AND a project they own, which is
// the minimum needed to create a task.
const userWithProject = async () => {
    const account = await registerAndLogin();
    const project = await createProject(account.token);

    return { ...account, projectId: project.body.project._id };
};

const listTasks = (token, query = "") =>
    request(app)
        .get(`/tasks${query}`)
        .set(...authHeader(token));

describe("Tasks", () => {
    describe("POST /tasks", () => {
        it("creates a task with sensible defaults", async () => {
            const { token, userId, projectId } = await userWithProject();

            const res = await createTask(token, projectId, { title: "Write docs" });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe("Task created successfully");
            expect(res.body.task.title).toBe("Write docs");
            expect(res.body.task.status).toBe("pending");
            expect(res.body.task.priority).toBe("medium");
            expect(res.body.task.project).toBe(projectId);
            expect(res.body.task.createdBy).toBe(userId);
            expect(res.body.task.assignedTo).toBeFalsy();
        });

        it("stores every field when provided", async () => {
            const { token, projectId } = await userWithProject();

            const res = await createTask(token, projectId, {
                title: "Ship release",
                description: "Cut the v1 tag",
                status: "in-progress",
                priority: "high",
                dueDate: "2026-01-31"
            });

            expect(res.status).toBe(201);
            expect(res.body.task.status).toBe("in-progress");
            expect(res.body.task.priority).toBe("high");
            expect(res.body.task.description).toBe("Cut the v1 tag");
            expect(new Date(res.body.task.dueDate).toISOString()).toBe(
                "2026-01-31T00:00:00.000Z"
            );
        });

        it("rejects an unknown status", async () => {
            const { token, projectId } = await userWithProject();

            const res = await createTask(token, projectId, { status: "done" });

            expect(res.status).toBe(400);
            expect(res.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "status" })
                ])
            );
        });

        it("rejects an unknown priority", async () => {
            const { token, projectId } = await userWithProject();

            const res = await createTask(token, projectId, { priority: "urgent" });

            expect(res.status).toBe(400);
        });

        it("rejects an impossible due date with 400, not 500", async () => {
            const { token, projectId } = await userWithProject();

            const res = await createTask(token, projectId, { dueDate: "31/13/2026" });

            expect(res.status).toBe(400);
            expect(res.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "dueDate" })
                ])
            );
        });

        it("rejects a malformed project id", async () => {
            const { token } = await registerAndLogin();

            const res = await createTask(token, "123", { title: "Bad project" });

            expect(res.status).toBe(400);
        });

        it("returns 404 when the project does not exist", async () => {
            const { token } = await registerAndLogin();

            const res = await createTask(token, randomId(), { title: "Orphan" });

            expect(res.status).toBe(404);
            expect(res.body.message).toBe("Project not found");
        });

        it("returns 403 when the project belongs to another user", async () => {
            const alice = await registerAndLogin();
            const bob = await registerAndLogin();
            const aliceProject = await createProject(alice.token);

            const res = await createTask(bob.token, aliceProject.body.project._id, {
                title: "Intruder"
            });

            expect(res.status).toBe(403);
        });

        it("accepts an existing assignee", async () => {
            const { token, projectId } = await userWithProject();
            const assignee = await registerAndLogin();

            const res = await createTask(token, projectId, {
                title: "Assigned work",
                assignedTo: assignee.userId
            });

            expect(res.status).toBe(201);
            expect(res.body.task.assignedTo).toBe(assignee.userId);
        });

        it("returns 404 when the assignee does not exist", async () => {
            const { token, projectId } = await userWithProject();

            const res = await createTask(token, projectId, {
                title: "Nobody",
                assignedTo: randomId()
            });

            expect(res.status).toBe(404);
            expect(res.body.message).toBe("Assigned user not found");
        });
    });

    describe("GET /tasks", () => {
        it("returns only the caller's tasks", async () => {
            const alice = await userWithProject();
            const bob = await userWithProject();

            await createTask(alice.token, alice.projectId, { title: "Alice task" });
            await createTask(bob.token, bob.projectId, { title: "Bob task" });

            const res = await listTasks(alice.token);

            expect(res.status).toBe(200);
            expect(res.body.totalTasks).toBe(1);
            expect(res.body.tasks[0].title).toBe("Alice task");
        });

        it("filters by status", async () => {
            const { token, projectId } = await userWithProject();

            await createTask(token, projectId, { title: "A", status: "pending" });
            await createTask(token, projectId, { title: "B", status: "completed" });
            await createTask(token, projectId, { title: "C", status: "completed" });

            const res = await listTasks(token, "?status=completed");

            expect(res.body.totalTasks).toBe(2);
            expect(res.body.tasks.every((t) => t.status === "completed")).toBe(true);
        });

        it("filters by priority", async () => {
            const { token, projectId } = await userWithProject();

            await createTask(token, projectId, { title: "A", priority: "low" });
            await createTask(token, projectId, { title: "B", priority: "high" });

            const res = await listTasks(token, "?priority=high");

            expect(res.body.totalTasks).toBe(1);
            expect(res.body.tasks[0].title).toBe("B");
        });

        it("searches title and description, case-insensitively", async () => {
            const { token, projectId } = await userWithProject();

            await createTask(token, projectId, { title: "Fix Login bug" });
            await createTask(token, projectId, {
                title: "Unrelated",
                description: "touches the login flow"
            });
            await createTask(token, projectId, { title: "Deploy" });

            const res = await listTasks(token, "?search=LOGIN");

            expect(res.body.totalTasks).toBe(2);
        });

        it("treats regex characters in search as plain text", async () => {
            const { token, projectId } = await userWithProject();

            await createTask(token, projectId, { title: "Learn C++ basics" });
            await createTask(token, projectId, { title: "Learn Rust basics" });

            // Without escaping this would be an invalid regular expression
            // and crash the query with a 500.
            const res = await listTasks(token, `?search=${encodeURIComponent("C++")}`);

            expect(res.status).toBe(200);
            expect(res.body.totalTasks).toBe(1);
            expect(res.body.tasks[0].title).toBe("Learn C++ basics");
        });

        it("paginates and reports the totals", async () => {
            const { token, projectId } = await userWithProject();

            for (let i = 1; i <= 12; i++) {
                await createTask(token, projectId, { title: `Task ${i}` });
            }

            const page1 = await listTasks(token, "?page=1&limit=10");

            expect(page1.body.totalTasks).toBe(12);
            expect(page1.body.currentPage).toBe(1);
            expect(page1.body.totalPages).toBe(2);
            expect(page1.body.pageSize).toBe(10);
            expect(page1.body.tasks).toHaveLength(10);

            const page2 = await listTasks(token, "?page=2&limit=10");
            expect(page2.body.tasks).toHaveLength(2);
        });

        it("sorts by title ascending", async () => {
            const { token, projectId } = await userWithProject();

            await createTask(token, projectId, { title: "Charlie" });
            await createTask(token, projectId, { title: "Alpha" });
            await createTask(token, projectId, { title: "Bravo" });

            const res = await listTasks(token, "?sortBy=title&order=asc");

            expect(res.body.tasks.map((t) => t.title)).toEqual([
                "Alpha",
                "Bravo",
                "Charlie"
            ]);
        });

        it("defaults to newest first", async () => {
            const { token, projectId } = await userWithProject();

            await createTask(token, projectId, { title: "First" });
            await createTask(token, projectId, { title: "Second" });

            const res = await listTasks(token);

            expect(res.body.tasks[0].title).toBe("Second");
        });
    });

    describe("GET /tasks/:id", () => {
        it("returns the task for its owner", async () => {
            const { token, projectId } = await userWithProject();
            const created = await createTask(token, projectId, { title: "Mine" });

            const res = await request(app)
                .get(`/tasks/${created.body.task._id}`)
                .set(...authHeader(token));

            expect(res.status).toBe(200);
            expect(res.body.task.title).toBe("Mine");
        });

        it("returns 404 for an unknown task", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .get(`/tasks/${randomId()}`)
                .set(...authHeader(token));

            expect(res.status).toBe(404);
        });
    });

    describe("PUT /tasks/:id", () => {
        it("updates only the fields that were sent", async () => {
            const { token, projectId } = await userWithProject();
            const created = await createTask(token, projectId, {
                title: "Original",
                priority: "low"
            });

            const res = await request(app)
                .put(`/tasks/${created.body.task._id}`)
                .set(...authHeader(token))
                .send({ status: "completed" });

            expect(res.status).toBe(200);
            expect(res.body.task.status).toBe("completed");
            expect(res.body.task.title).toBe("Original");
            expect(res.body.task.priority).toBe("low");
        });

        it("unassigns a task when assignedTo is null", async () => {
            const { token, projectId } = await userWithProject();
            const assignee = await registerAndLogin();
            const created = await createTask(token, projectId, {
                title: "Assigned",
                assignedTo: assignee.userId
            });

            const res = await request(app)
                .put(`/tasks/${created.body.task._id}`)
                .set(...authHeader(token))
                .send({ assignedTo: null });

            expect(res.status).toBe(200);
            expect(res.body.task.assignedTo).toBeFalsy();
        });

        it("rejects an invalid status value", async () => {
            const { token, projectId } = await userWithProject();
            const created = await createTask(token, projectId, { title: "X" });

            const res = await request(app)
                .put(`/tasks/${created.body.task._id}`)
                .set(...authHeader(token))
                .send({ status: "nope" });

            expect(res.status).toBe(400);
        });

        it("returns 404 when the new assignee does not exist", async () => {
            const { token, projectId } = await userWithProject();
            const created = await createTask(token, projectId, { title: "X" });

            const res = await request(app)
                .put(`/tasks/${created.body.task._id}`)
                .set(...authHeader(token))
                .send({ assignedTo: randomId() });

            expect(res.status).toBe(404);
        });

        it("cannot move a task to another project", async () => {
            const { token, projectId } = await userWithProject();
            const other = await createProject(token);
            const created = await createTask(token, projectId, { title: "Stay put" });

            const res = await request(app)
                .put(`/tasks/${created.body.task._id}`)
                .set(...authHeader(token))
                .send({ project: other.body.project._id });

            expect(res.status).toBe(200);
            // "project" is not part of updateTaskSchema, so it is stripped.
            expect(res.body.task.project).toBe(projectId);
        });
    });

    describe("DELETE /tasks/:id", () => {
        it("deletes the task", async () => {
            const { token, projectId } = await userWithProject();
            const created = await createTask(token, projectId, { title: "Delete me" });
            const id = created.body.task._id;

            const res = await request(app)
                .delete(`/tasks/${id}`)
                .set(...authHeader(token));

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Task deleted successfully");

            const after = await request(app)
                .get(`/tasks/${id}`)
                .set(...authHeader(token));

            expect(after.status).toBe(404);
        });
    });

    describe("cascade delete", () => {
        it("removes a project's tasks when the project is deleted", async () => {
            const { token, projectId } = await userWithProject();

            await createTask(token, projectId, { title: "One" });
            await createTask(token, projectId, { title: "Two" });

            // A task in a different project must survive.
            const other = await createProject(token);
            await createTask(token, other.body.project._id, { title: "Survivor" });

            await request(app)
                .delete(`/projects/${projectId}`)
                .set(...authHeader(token));

            const res = await listTasks(token);

            expect(res.body.totalTasks).toBe(1);
            expect(res.body.tasks[0].title).toBe("Survivor");
        });
    });
});

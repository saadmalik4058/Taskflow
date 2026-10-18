const {
    app,
    request,
    authHeader,
    registerAndLogin,
    registerAsAdmin,
    createProject,
    createTask
} = require("./helpers");

// These tests are about WHO may do WHAT, the part most likely to be broken
// by a careless refactor and the part that matters most for security.

describe("Authorization", () => {
    describe("admin-only routes", () => {
        it("blocks a normal user from GET /users with 403", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .get("/users")
                .set(...authHeader(token));

            expect(res.status).toBe(403);
            expect(res.body.message).toBe(
                "You do not have permission to perform this action"
            );
        });

        it("allows an admin to GET /users", async () => {
            await registerAndLogin(); // an ordinary user also exists
            const { token } = await registerAsAdmin();

            const res = await request(app)
                .get("/users")
                .set(...authHeader(token));

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.users)).toBe(true);
            expect(res.body.users.length).toBeGreaterThan(0);
        });

        it("never returns password hashes from GET /users", async () => {
            const { token } = await registerAsAdmin();

            const res = await request(app)
                .get("/users")
                .set(...authHeader(token));

            for (const user of res.body.users) {
                expect(user.password).toBeUndefined();
            }
        });

        it("requires a token at all", async () => {
            const res = await request(app).get("/users");

            expect(res.status).toBe(401);
        });

        it("stops working after the user is demoted (role comes from the token)", async () => {
            const User = require("../src/models/User");
            const { userId, token } = await registerAsAdmin();

            // The old token still says "admin" because roles live in the
            // signed token, not the database. This documents that trade-off.
            const before = await request(app)
                .get("/users")
                .set(...authHeader(token));
            expect(before.status).toBe(200);

            await User.updateOne({ _id: userId }, { role: "user" });

            // Same token, still valid until it expires.
            const after = await request(app)
                .get("/users")
                .set(...authHeader(token));
            expect(after.status).toBe(200);
        });
    });

    describe("projects owned by someone else", () => {
        it("forbids reading another user's project", async () => {
            const owner = await registerAndLogin();
            const intruder = await registerAndLogin();
            const project = await createProject(owner.token);

            const res = await request(app)
                .get(`/projects/${project.body.project._id}`)
                .set(...authHeader(intruder.token));

            expect(res.status).toBe(403);
        });

        it("forbids updating another user's project", async () => {
            const owner = await registerAndLogin();
            const intruder = await registerAndLogin();
            const project = await createProject(owner.token);

            const res = await request(app)
                .put(`/projects/${project.body.project._id}`)
                .set(...authHeader(intruder.token))
                .send({ name: "Hijacked" });

            expect(res.status).toBe(403);
        });

        it("forbids deleting another user's project", async () => {
            const owner = await registerAndLogin();
            const intruder = await registerAndLogin();
            const project = await createProject(owner.token);

            const res = await request(app)
                .delete(`/projects/${project.body.project._id}`)
                .set(...authHeader(intruder.token));

            expect(res.status).toBe(403);
        });

        it("does not list another user's projects", async () => {
            const owner = await registerAndLogin();
            const intruder = await registerAndLogin();
            await createProject(owner.token);

            const res = await request(app)
                .get("/projects")
                .set(...authHeader(intruder.token));

            expect(res.body.projects).toHaveLength(0);
        });
    });

    describe("tasks owned by someone else", () => {
        const setup = async () => {
            const owner = await registerAndLogin();
            const intruder = await registerAndLogin();
            const project = await createProject(owner.token);
            const task = await createTask(owner.token, project.body.project._id, {
                title: "Private task"
            });

            return { owner, intruder, taskId: task.body.task._id };
        };

        it("forbids reading another user's task", async () => {
            const { intruder, taskId } = await setup();

            const res = await request(app)
                .get(`/tasks/${taskId}`)
                .set(...authHeader(intruder.token));

            expect(res.status).toBe(403);
        });

        it("forbids updating another user's task", async () => {
            const { intruder, taskId } = await setup();

            const res = await request(app)
                .put(`/tasks/${taskId}`)
                .set(...authHeader(intruder.token))
                .send({ status: "completed" });

            expect(res.status).toBe(403);
        });

        it("forbids deleting another user's task", async () => {
            const { intruder, taskId } = await setup();

            const res = await request(app)
                .delete(`/tasks/${taskId}`)
                .set(...authHeader(intruder.token));

            expect(res.status).toBe(403);
        });

        it("does not leak another user's tasks through the list", async () => {
            const { intruder } = await setup();

            const res = await request(app)
                .get("/tasks")
                .set(...authHeader(intruder.token));

            expect(res.body.totalTasks).toBe(0);
        });
    });
});

const mongoose = require("mongoose");

const {
    app,
    request,
    authHeader,
    registerAndLogin,
    createProject
} = require("./helpers");

const randomId = () => new mongoose.Types.ObjectId().toString();

describe("Projects", () => {
    describe("POST /projects", () => {
        it("creates a project owned by the caller", async () => {
            const { token, userId } = await registerAndLogin();

            const res = await request(app)
                .post("/projects")
                .set(...authHeader(token))
                .send({ name: "Website Redesign", description: "Q3 work" });

            expect(res.status).toBe(201);
            expect(res.body.message).toBe("Project created successfully");
            expect(res.body.project.name).toBe("Website Redesign");
            expect(res.body.project.description).toBe("Q3 work");
            expect(res.body.project.createdBy).toBe(userId);
        });

        it("requires a name", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .post("/projects")
                .set(...authHeader(token))
                .send({ description: "no name" });

            expect(res.status).toBe(400);
            expect(res.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "name" })
                ])
            );
        });

        it("rejects an empty name after trimming", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .post("/projects")
                .set(...authHeader(token))
                .send({ name: "     " });

            expect(res.status).toBe(400);
        });

        it("ignores a createdBy injected by the client (mass assignment)", async () => {
            const { token, userId } = await registerAndLogin();

            const res = await request(app)
                .post("/projects")
                .set(...authHeader(token))
                // A malicious client tries to assign the project to someone else.
                .send({ name: "Sneaky", createdBy: randomId() });

            expect(res.status).toBe(201);
            expect(res.body.project.createdBy).toBe(userId);
        });

        it("requires authentication", async () => {
            const res = await request(app)
                .post("/projects")
                .send({ name: "Anonymous" });

            expect(res.status).toBe(401);
        });
    });

    describe("GET /projects", () => {
        it("returns only the caller's projects", async () => {
            const alice = await registerAndLogin();
            const bob = await registerAndLogin();

            await createProject(alice.token, { name: "Alice project" });
            await createProject(bob.token, { name: "Bob project" });

            const res = await request(app)
                .get("/projects")
                .set(...authHeader(alice.token));

            expect(res.status).toBe(200);
            expect(res.body.projects).toHaveLength(1);
            expect(res.body.projects[0].name).toBe("Alice project");
        });
    });

    describe("GET /projects/:id", () => {
        it("returns the project for its owner", async () => {
            const { token } = await registerAndLogin();
            const created = await createProject(token);

            const res = await request(app)
                .get(`/projects/${created.body.project._id}`)
                .set(...authHeader(token));

            expect(res.status).toBe(200);
            expect(res.body.project.name).toBe("Test Project");
        });

        it("returns 404 for a well-formed but unused id", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .get(`/projects/${randomId()}`)
                .set(...authHeader(token));

            expect(res.status).toBe(404);
            expect(res.body.message).toBe("Project not found");
        });

        it("returns 400 for a malformed id", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .get("/projects/not-an-object-id")
                .set(...authHeader(token));

            expect(res.status).toBe(400);
            expect(res.body.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ field: "id" })
                ])
            );
        });
    });

    describe("PUT /projects/:id", () => {
        it("updates the provided fields", async () => {
            const { token } = await registerAndLogin();
            const created = await createProject(token, {
                name: "Old name",
                description: "Old description"
            });

            const res = await request(app)
                .put(`/projects/${created.body.project._id}`)
                .set(...authHeader(token))
                .send({ name: "New name" });

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Project updated successfully");
            expect(res.body.project.name).toBe("New name");
            // Not sent, so it must be untouched (partial update).
            expect(res.body.project.description).toBe("Old description");
        });

        it("cannot be used to change createdBy", async () => {
            const { token, userId } = await registerAndLogin();
            const created = await createProject(token);

            const res = await request(app)
                .put(`/projects/${created.body.project._id}`)
                .set(...authHeader(token))
                .send({ name: "Renamed", createdBy: randomId() });

            expect(res.status).toBe(200);
            expect(res.body.project.createdBy).toBe(userId);
        });

        it("returns 404 for an unknown project", async () => {
            const { token } = await registerAndLogin();

            const res = await request(app)
                .put(`/projects/${randomId()}`)
                .set(...authHeader(token))
                .send({ name: "Ghost" });

            expect(res.status).toBe(404);
        });
    });

    describe("DELETE /projects/:id", () => {
        it("deletes the project and makes it unreachable", async () => {
            const { token } = await registerAndLogin();
            const created = await createProject(token);
            const id = created.body.project._id;

            const res = await request(app)
                .delete(`/projects/${id}`)
                .set(...authHeader(token));

            expect(res.status).toBe(200);
            expect(res.body.message).toBe("Project deleted successfully");

            const after = await request(app)
                .get(`/projects/${id}`)
                .set(...authHeader(token));

            expect(after.status).toBe(404);
        });
    });
});

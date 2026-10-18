// Database lifecycle for the test suite.
//
// mongodb-memory-server actually runs a real mongod process, but on a
// temporary directory and a random free port. Every test run therefore
// starts from a completely clean database, and the real "taskflow"
// database is never touched.
//
// These hooks run once per test FILE, so each file gets its own isolated
// database.

const os = require("os");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// ---------------------------------------------------------------------
// WHY THIS FILE PASSES `runtimeAdapters`
//
// The MongoDB driver (7.x) loads Node's `os` module lazily with a dynamic
// `import("os")` (see node_modules/mongodb/lib/runtime_adapters.js). Jest
// runs test files inside a sandboxed `vm` context, and dynamic import is
// disabled there unless Node is started with --experimental-vm-modules.
//
// When that import fails, the driver silently falls back to EMPTY client
// metadata. mongod then rejects the connection with:
//
//   MongooseServerSelectionError: Missing required sub-document 'driver'
//   in the client metadata document
//
// The driver exposes `runtimeAdapters` as an official escape hatch for
// exactly this situation: if we hand it the `os` module ourselves, it
// never runs the dynamic import. Supplying it only here means production
// code (src/server.js) is completely unaffected.
// ---------------------------------------------------------------------
const runtimeAdapters = { os };

let mongoServer;

beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    await mongoose.connect(mongoServer.getUri(), {
        runtimeAdapters,
        serverSelectionTimeoutMS: 20000
    });
});

// Runs after EACH test, so one test can never see another test's data.
// Without this, creating "test@example.com" in one test would make a
// duplicate-email test in the next file fail for the wrong reason.
afterEach(async () => {
    const { collections } = mongoose.connection;

    await Promise.all(
        Object.values(collections).map((collection) => collection.deleteMany({}))
    );
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

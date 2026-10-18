module.exports = {
    // "node" because this is a backend API, not a browser app. There is no
    // DOM to simulate.
    testEnvironment: "node",

    // Runs BEFORE the test framework is installed and before any test file
    // is loaded. The right place for environment variables, because modules
    // like src/middleware/rateLimiters.js read NODE_ENV when they load.
    setupFiles: ["<rootDir>/tests/setupEnv.js"],

    // Runs once per test file, after the test framework is ready. The right
    // place for beforeAll / afterEach hooks such as the database lifecycle.
    setupFilesAfterEnv: ["<rootDir>/tests/setupDb.js"],

    testMatch: ["<rootDir>/tests/**/*.test.js"],

    // Each test file lives in its own worker process. Running them one after
    // another keeps a single in-memory MongoDB alive at a time and avoids
    // several mongod instances competing for memory.
    maxWorkers: 1,

    // The very first run downloads the MongoDB binary, which can be slow.
    testTimeout: 60000,

    clearMocks: true,
    verbose: true
};

// Reusable validation middleware.
//
// Usage in a route file:
//   router.post("/register", validateBody(registerSchema), register);
//
// If validation fails, the request never reaches the controller.
// The client receives one standardized 400 response:
//   {
//     "success": false,
//     "message": "Validation failed",
//     "errors": [{ "field": "email", "message": "..." }]
//   }
//
// If validation passes, req.body / req.query / req.params are REPLACED
// with the cleaned data (trimmed strings, converted numbers/dates,
// default values applied, unknown fields removed). This last part also
// blocks mass assignment: a client cannot smuggle extra fields such as
// "role" or "createdBy" past the schema.

const validate = (schema, target) => (req, res, next) => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.length > 0 ? issue.path.join(".") : target,
            message: issue.message
        }));

        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors
        });
    }

    // IMPORTANT Express 5 detail: req.query is a read-only getter, so a
    // normal `req.query = result.data` silently does nothing. Using
    // Object.defineProperty creates an own property that shadows the
    // getter, which works for body, query and params alike.
    Object.defineProperty(req, target, {
        value: result.data,
        writable: true,
        configurable: true,
        enumerable: true
    });

    next();
};

const validateBody = (schema) => validate(schema, "body");

const validateParams = (schema) => validate(schema, "params");

const validateQuery = (schema) => validate(schema, "query");

module.exports = {
    validateBody,
    validateParams,
    validateQuery
};

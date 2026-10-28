const AppError = require('../utils/AppError');

// Valide body / query / params avec des schémas zod.
// Usage : router.post('/', validate({ body: createSchema, query: listQuery }), controller.create)
// Les données validées (et converties : nombres, valeurs par défaut) sont disponibles dans
// req.validated.body / .query / .params. Express 5 interdit de réassigner req.query,
// c'est pourquoi on ne l'écrase pas.
const validate = (schemas) => (req, res, next) => {
  const validated = {};
  const errors = [];

  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      validated[part] = result.data;
    } else {
      for (const issue of result.error.issues) {
        errors.push({
          in: part,
          field: issue.path.join('.') || null,
          message: issue.message,
        });
      }
    }
  }

  if (errors.length) {
    return next(new AppError('Données invalides', 400, 'VALIDATION_ERROR', errors));
  }

  req.validated = validated;
  if (validated.body) req.body = validated.body;
  next();
};

module.exports = validate;
// Format de réponse commun : { success, message?, data?, meta? }
const success = (res, data = null, { status = 200, message, meta } = {}) => {
  const body = { success: true };
  if (message) body.message = message;
  if (data !== null) body.data = data;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
};

const created = (res, data, message = 'Créé avec succès') => success(res, data, { status: 201, message });

module.exports = { success, created };

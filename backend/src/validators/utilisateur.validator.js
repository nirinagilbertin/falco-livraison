const { z } = require('zod');
const { paginationQuery, q, email, telephone } = require('./common.validator');
const { nomUtilisateur } = require('./auth.validator');

const ROLES_INTERNES = ['gestionnaire', 'superviseur'];
const roleInterne = z.enum(ROLES_INTERNES, { error: 'Rôle invalide : gestionnaire ou superviseur' });

const create = z.object({
  email,
  nom_utilisateur: nomUtilisateur,
  nom: z.string().trim().min(1).max(80),
  prenom: z.string().trim().min(1).max(80),
  telephone,
  role: roleInterne,
});

const changeRole = z.object({ role: roleInterne });

const listQuery = paginationQuery.extend({
  role: z.enum(['administrateur', 'gestionnaire', 'superviseur', 'livreur', 'expediteur']).optional(),
  statut: z.enum(['actif', 'suspendu']).optional(),
  q,
});

module.exports = { create, changeRole, listQuery };
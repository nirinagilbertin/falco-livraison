const { executor } = require('../config/db');
const { likeParam, buildWhere, buildLimit } = require('../utils/sql');

// Liste des comptes avec le nom et le téléphone de leur profil, quel que soit le rôle
const list = async ({ role, statut, q }, pagination) => {
  const clauses = [];
  const params = {};
  if (role) { clauses.push('c.role = :role'); params.role = role; }
  if (statut) { clauses.push('c.statut = :statut'); params.statut = statut; }
  if (q) {
    clauses.push(`(c.email LIKE :q OR c.nom_utilisateur LIKE :q
      OR CONCAT_WS(' ', ui.prenom, ui.nom, l.prenom, l.nom, e.nom_complet) LIKE :q)`);
    params.q = likeParam(q);
  }
  const where = buildWhere(clauses);
  const joins = `FROM compte c
    LEFT JOIN utilisateur_interne ui ON ui.id_compte = c.id_compte
    LEFT JOIN livreur l ON l.id_compte = c.id_compte
    LEFT JOIN expediteur e ON e.id_compte = c.id_compte`;
  const run = executor();

  const rows = await run(
    `SELECT c.id_compte, c.email, c.nom_utilisateur, c.role, c.statut, c.mot_de_passe_temporaire,
            c.date_creation, c.derniere_connexion,
            COALESCE(CONCAT(ui.prenom, ' ', ui.nom), CONCAT(l.prenom, ' ', l.nom), e.nom_complet) AS nom_complet,
            COALESCE(ui.telephone, l.telephone, e.telephone) AS telephone,
            e.type_expediteur
     ${joins} ${where} ORDER BY c.date_creation DESC, c.id_compte DESC ${buildLimit(pagination)}`,
    params
  );
  const [{ total }] = await run(`SELECT COUNT(*) AS total ${joins} ${where}`, params);

  const items = rows.map((r) => ({ ...r, mot_de_passe_temporaire: Boolean(r.mot_de_passe_temporaire) }));
  return { items, total };
};

const updateRole = (conn, id_compte, role) =>
  executor(conn)('UPDATE compte SET role = :role WHERE id_compte = :id_compte', { id_compte, role });

const updateStatut = (conn, id_compte, statut) =>
  executor(conn)('UPDATE compte SET statut = :statut WHERE id_compte = :id_compte', { id_compte, statut });

// Supprime le profil lié puis le compte. Échoue (clé étrangère) dès que le compte a un historique.
const deleteAccount = async (conn, { id_compte, role }) => {
  const run = executor(conn);
  if (role === 'livreur') {
    await run('DELETE FROM livreur_permis WHERE id_livreur IN (SELECT id_livreur FROM livreur WHERE id_compte = :id_compte)', { id_compte });
    await run('DELETE FROM livreur_zone WHERE id_livreur IN (SELECT id_livreur FROM livreur WHERE id_compte = :id_compte)', { id_compte });
    await run('DELETE FROM livreur WHERE id_compte = :id_compte', { id_compte });
  } else if (role === 'expediteur') {
    await run('DELETE FROM expediteur WHERE id_compte = :id_compte', { id_compte });
  } else {
    await run('DELETE FROM utilisateur_interne WHERE id_compte = :id_compte', { id_compte });
  }
  await run('DELETE FROM compte WHERE id_compte = :id_compte', { id_compte });
};

module.exports = { list, updateRole, updateStatut, deleteAccount };
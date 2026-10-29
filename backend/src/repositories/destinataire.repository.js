const { executor } = require('../config/db');

const createMany = async (conn, id_demande, items) => {
  const run = executor(conn);
  for (const d of items) {
    await run(
      `INSERT INTO destinataire (id_demande, nom, prenom, telephone, est_principal)
       VALUES (:id_demande, :nom, :prenom, :telephone, :est_principal)`,
      { id_demande, nom: d.nom, prenom: d.prenom ?? null, telephone: d.telephone, est_principal: d.est_principal ? 1 : 0 }
    );
  }
};

const findByDemande = async (id_demande, conn) => {
  const rows = await executor(conn)(
    'SELECT id_destinataire, nom, prenom, telephone, est_principal FROM destinataire WHERE id_demande = :id_demande ORDER BY id_destinataire',
    { id_demande }
  );
  return rows.map((r) => ({ ...r, est_principal: Boolean(r.est_principal) }));
};

module.exports = { createMany, findByDemande };
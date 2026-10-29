const { executor } = require('../config/db');

const createMany = async (conn, id_demande, items) => {
  const run = executor(conn);
  for (const c of items) {
    await run(
      `INSERT INTO colis (id_demande, libelle, description, emballage, poids_estime, longueur, largeur, hauteur, instructions)
       VALUES (:id_demande, :libelle, :description, :emballage, :poids_estime, :longueur, :largeur, :hauteur, :instructions)`,
      {
        id_demande,
        libelle: c.libelle,
        description: c.description ?? null,
        emballage: c.emballage ?? null,
        poids_estime: c.poids_estime,
        longueur: c.longueur ?? null,
        largeur: c.largeur ?? null,
        hauteur: c.hauteur ?? null,
        instructions: c.instructions ?? null,
      }
    );
  }
};

const findByDemande = (id_demande, conn) =>
  executor(conn)(
    `SELECT id_colis, libelle, description, emballage, poids_estime, poids_reel, longueur, largeur, hauteur,
            instructions, statut, id_depot, date_depot
     FROM colis WHERE id_demande = :id_demande ORDER BY id_colis`,
    { id_demande }
  );

module.exports = { createMany, findByDemande };
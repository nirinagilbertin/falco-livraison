const { executor } = require('../config/db');

const COLUMNS = `id_paiement, id_demande, montant, mode_paiement, statut, carte_derniers_chiffres, titulaire_carte,
  operateur_mobile, numero_payeur, reference_paiement, numero_recu, motif_echec, date_creation, date_paiement`;

// Un paiement est créé « en_cours » puis passe à « valide » ou « echoue » (aucune donnée sensible : champs masqués uniquement)
const create = async (conn, d) => {
  const result = await executor(conn)(
    `INSERT INTO paiement (id_demande, montant, mode_paiement, carte_derniers_chiffres, titulaire_carte,
        operateur_mobile, numero_payeur, reference_paiement)
     VALUES (:id_demande, :montant, :mode_paiement, :carte_derniers_chiffres, :titulaire_carte,
        :operateur_mobile, :numero_payeur, :reference_paiement)`,
    {
      id_demande: d.id_demande,
      montant: d.montant,
      mode_paiement: d.mode_paiement,
      carte_derniers_chiffres: d.carte_derniers_chiffres ?? null,
      titulaire_carte: d.titulaire_carte ?? null,
      operateur_mobile: d.operateur_mobile ?? null,
      numero_payeur: d.numero_payeur ?? null,
      reference_paiement: d.reference_paiement,
    }
  );
  return result.insertId;
};

const markValid = (conn, id_paiement, numero_recu) =>
  executor(conn)(
    "UPDATE paiement SET statut = 'valide', numero_recu = :numero_recu, date_paiement = NOW() WHERE id_paiement = :id_paiement",
    { id_paiement, numero_recu }
  );

const markFailed = (conn, id_paiement, motif) =>
  executor(conn)("UPDATE paiement SET statut = 'echoue', motif_echec = :motif WHERE id_paiement = :id_paiement", {
    id_paiement,
    motif: String(motif).slice(0, 255),
  });

const findById = async (id_paiement, conn) => {
  const rows = await executor(conn)(`SELECT ${COLUMNS} FROM paiement WHERE id_paiement = :id_paiement`, { id_paiement });
  return rows[0] || null;
};

// Historique des tentatives d'une demande
const findByDemande = (id_demande) =>
  executor()(`SELECT ${COLUMNS} FROM paiement WHERE id_demande = :id_demande ORDER BY id_paiement`, { id_demande });

module.exports = { create, markValid, markFailed, findById, findByDemande };
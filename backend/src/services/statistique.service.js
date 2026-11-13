const AppError = require('../utils/AppError');
const statistiqueRepository = require('../repositories/statistique.repository');
const profilRepository = require('../repositories/profil.repository');

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

const DEMANDE = ['en_attente', 'en_cours', 'verifiee', 'validee', 'annulee'];
const LIVRAISON = ['en_attente', 'affectee', 'en_cours', 'terminee', 'inachevee', 'annulee'];

const toMap = (rows, keys) => {
  const map = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const r of rows) map[r.statut] = Number(r.n);
  return map;
};
const sum = (map) => Object.values(map).reduce((a, b) => a + b, 0);
const pct = (a, b) => (b === 0 ? null : Math.round((a / b) * 1000) / 10);
const avg = (v) => (v === null || v === undefined ? null : Math.round(Number(v)));

// Période : par défaut les 30 derniers jours se terminant aujourd'hui
const resolvePeriod = ({ du, au } = {}) => {
  const end = au || fmtDate(new Date());
  const start = du || fmtDate(new Date(parseDate(end).getTime() - 29 * 86400000));
  return { du: start, au: end };
};

// CU-21 : tableau de bord global (administrateur, superviseur)
const dashboard = async (query) => {
  const p = resolvePeriod(query);
  const [demandes, livraisons, paiements, delais, livreurs, vehicules, alertes, incidents, comptes] = await Promise.all([
    statistiqueRepository.demandesByStatut(p),
    statistiqueRepository.livraisonsByStatut(p),
    statistiqueRepository.paiementsByStatutMode(p),
    statistiqueRepository.delais(p),
    statistiqueRepository.livreursByDisponibilite(),
    statistiqueRepository.vehiculesByStatut(),
    statistiqueRepository.alertesOuvertes(),
    statistiqueRepository.incidentsOuverts(),
    statistiqueRepository.comptesActifs(),
  ]);

  const demandesMap = toMap(demandes, DEMANDE);
  const livraisonsMap = toMap(livraisons, LIVRAISON);

  const valides = paiements.filter((r) => r.statut === 'valide');
  const parMode = {};
  for (const r of valides) parMode[r.mode_paiement] = { nombre: Number(r.n), montant: Number(r.total) };

  return {
    periode: p,
    demandes: { total: sum(demandesMap), par_statut: demandesMap },
    livraisons: {
      total: sum(livraisonsMap),
      par_statut: livraisonsMap,
      taux_terminees_pct: pct(livraisonsMap.terminee, sum(livraisonsMap)),
    },
    paiements: {
      valides: { nombre: valides.reduce((a, r) => a + Number(r.n), 0), montant_total: valides.reduce((a, r) => a + Number(r.total), 0) },
      echoues: paiements.filter((r) => r.statut === 'echoue').reduce((a, r) => a + Number(r.n), 0),
      par_mode: parMode,
    },
    delais: { affectation_moyenne_min: avg(delais.affectation_min), livraison_moyenne_min: avg(delais.livraison_min) },
    etat_actuel: {
      livreurs: toMap(livreurs, ['libre', 'occupe', 'hors_service']),
      vehicules: toMap(vehicules, ['disponible', 'en_service', 'en_maintenance', 'hors_service']),
      alertes_ouvertes: toMap(alertes, ['eleve', 'moyen', 'faible']),
      incidents_ouverts: toMap(incidents, ['nouveau', 'en_cours']),
      comptes_actifs: toMap(comptes, ['administrateur', 'gestionnaire', 'superviseur', 'livreur', 'expediteur']),
    },
  };
};

// Liste des périodes (jours ou mois) entre deux dates, pour que les graphiques n'aient aucun trou
const keysBetween = (du, au, pas) => {
  const keys = [];
  const end = parseDate(au);
  let d = parseDate(du);
  if (pas === 'mois') {
    d = new Date(d.getFullYear(), d.getMonth(), 1);
    while (d <= end) {
      keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }
  } else {
    while (d <= end) {
      keys.push(fmtDate(d));
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    }
  }
  return keys;
};

// Séries pour les graphiques : demandes créées, livraisons terminées, revenus
const evolution = async (query) => {
  const p = resolvePeriod(query);
  const pas = query.pas || 'jour';
  const days = (parseDate(p.au) - parseDate(p.du)) / 86400000;
  if (pas === 'jour' && days > 366) throw AppError.badRequest('Période trop longue pour un pas journalier (366 jours maximum)');
  if (pas === 'mois' && days > 1830) throw AppError.badRequest('Période trop longue (5 ans maximum)');

  const fmt = pas === 'mois' ? '%Y-%m' : '%Y-%m-%d';
  const [demandes, terminees, revenus] = await Promise.all([
    statistiqueRepository.seriesDemandes(p, fmt),
    statistiqueRepository.seriesTerminees(p, fmt),
    statistiqueRepository.seriesRevenus(p, fmt),
  ]);
  const byKey = (rows) => Object.fromEntries(rows.map((r) => [r.periode, Number(r.n)]));
  const d = byKey(demandes);
  const t = byKey(terminees);
  const r = byKey(revenus);

  return {
    periode: p,
    pas,
    points: keysBetween(p.du, p.au, pas).map((k) => ({
      periode: k,
      demandes_creees: d[k] || 0,
      livraisons_terminees: t[k] || 0,
      revenus: r[k] || 0,
    })),
  };
};

// Performance de chaque livreur sur la période
const livreurs = async (query) => {
  const p = resolvePeriod(query);
  const rows = await statistiqueRepository.livreursPerformance(p);
  return {
    periode: p,
    livreurs: rows.map((r) => ({
      ...r,
      taux_reussite_pct: pct(Number(r.terminees), Number(r.terminees) + Number(r.inachevees)),
    })),
  };
};

// Statistiques personnelles de l'expéditeur ou du livreur connecté
const me = async (user, query) => {
  const p = resolvePeriod(query);

  if (user.role === 'expediteur') {
    const expediteur = await profilRepository.findByCompte('expediteur', user.id_compte);
    if (!expediteur) throw AppError.forbidden('Profil expéditeur introuvable');
    const [demandes, livraisons, depense, incidents] = await Promise.all([
      statistiqueRepository.senderDemandes(expediteur.id_expediteur, p),
      statistiqueRepository.senderLivraisons(expediteur.id_expediteur, p),
      statistiqueRepository.senderSpend(expediteur.id_expediteur, p),
      statistiqueRepository.incidentsDeclared(user.id_compte, p),
    ]);
    const demandesMap = toMap(demandes, DEMANDE);
    return {
      role: 'expediteur',
      periode: p,
      demandes: { total: sum(demandesMap), par_statut: demandesMap },
      livraisons: toMap(livraisons, LIVRAISON),
      depense: {
        paiements_valides: Number(depense.n),
        montant_total: Number(depense.total),
        montant_moyen: Number(depense.n) > 0 ? Math.round((Number(depense.total) / Number(depense.n)) * 100) / 100 : null,
      },
      incidents_declares: incidents,
    };
  }

  const livreur = await profilRepository.findByCompte('livreur', user.id_compte);
  if (!livreur) throw AppError.forbidden('Profil livreur introuvable');
  const s = await statistiqueRepository.courierStats(livreur.id_livreur, user.id_compte, p);
  const terminees = Number(s.terminees);
  const inachevees = Number(s.inachevees);
  return {
    role: 'livreur',
    periode: p,
    missions: { acceptees: Number(s.missions_acceptees), refusees: Number(s.refus), expirees: Number(s.expirees) },
    livraisons: { terminees, inachevees, taux_reussite_pct: pct(terminees, terminees + inachevees) },
    distance_km: Math.round(Number(s.distance_km) * 100) / 100,
  };
};

module.exports = { dashboard, evolution, livreurs, me };
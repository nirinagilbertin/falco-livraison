// Test de bout en bout : crée des données de test (préfixées TEST) et déroule une livraison complète.
// Usage : ADMIN_PASSWORD=... npm run smoke   (API démarrée ; BASE_URL et ADMIN_EMAIL facultatifs). Node 18 ou plus.
const BASE = process.env.BASE_URL || 'http://localhost:3000/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@falco.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

let passed = 0;
let failed = 0;
const check = (name, ok, detail) => {
  if (ok) { passed += 1; console.log(`OK     ${name}`); }
  else { failed += 1; console.log(`ÉCHEC  ${name}${detail ? ` -> ${JSON.stringify(detail)}` : ''}`); }
  return ok;
};

const call = async (method, path, body, token) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined || body === null ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* corps vide */ }
  return { status: res.status, body: json, data: json ? json.data : undefined, meta: json ? json.meta : undefined };
};

// Étape bloquante : si elle échoue, la suite n'a pas de sens
const must = (name, r, status) => {
  const ok = r.status === status;
  check(`${name} (${r.status})`, ok, ok ? undefined : r.body);
  if (!ok) throw new Error(`Étape bloquante : ${name}`);
  return r;
};

const run = async () => {
  if (!ADMIN_PASSWORD) {
    console.error('Définis ADMIN_PASSWORD (mot de passe actuel de l\'administrateur) avant de lancer le test.');
    process.exit(1);
  }

  const id = Date.now().toString(36);
  // Zone de test dans un carré géographique choisi au hasard : aucun chevauchement avec tes vraies zones
  const cell = Math.floor(Math.random() * 1000);
  const lat0 = -20 + (cell % 25) * 0.1;
  const lon0 = 44 + Math.floor(cell / 25) * 0.1;
  const rect = {
    type: 'Polygon',
    coordinates: [[[lon0, lat0], [lon0 + 0.04, lat0], [lon0 + 0.04, lat0 + 0.04], [lon0, lat0 + 0.04], [lon0, lat0]]],
  };
  const pickup = { latitude: lat0 + 0.01, longitude: lon0 + 0.01 };
  const dropoff = { latitude: lat0 + 0.03, longitude: lon0 + 0.03 };

  console.log('--- Mise en place');
  const login = must('Connexion de l\'administrateur', await call('POST', '/auth/login', { email: ADMIN_EMAIL, mot_de_passe: ADMIN_PASSWORD }), 200);
  const admin = login.data.token;
  if (login.data.compte.mot_de_passe_temporaire) throw new Error('Le mot de passe administrateur est encore temporaire : change-le d\'abord (POST /auth/change-password).');

  const tarif = await call('GET', '/tarifs/actif', null, admin);
  if (tarif.status === 404) must('Création du tarif', await call('POST', '/tarifs', { frais_base: 1000, prix_par_km: 500, prix_par_kg: 200, activer: true }, admin), 201);
  else check('Tarif actif présent', tarif.status === 200, tarif.body);

  const depot = must('Création du dépôt', await call('POST', '/depots', { nom: `TEST Dépôt ${id}`, adresse: 'Adresse de test', latitude: pickup.latitude, longitude: pickup.longitude }, admin), 201).data;
  const zone = must('Création de la zone avec polygone', await call('POST', '/zones', { id_depot: depot.id_depot, nom_zone: `TEST Zone ${id}`, ville: `TEST ${id}`, limites_geographiques: rect }, admin), 201).data;
  const vehicule = must('Création du véhicule', await call('POST', '/vehicules', { id_zone: zone.id_zone, immatriculation: `TST-${id}`.toUpperCase(), marque: 'Test', modele: 'Test', type_vehicule: 'moto', carburant: 'essence', capacite_poids: 50 }, admin), 201).data;
  const livreur = must('Création du livreur', await call('POST', '/livreurs', {
    email: `livreur.${id}@test.local`, nom_utilisateur: `livreur_${id}`, nom: 'Test', prenom: 'Livreur', telephone: '0340000001',
    cin: `CIN${id}`.toUpperCase(), permis: ['B'], zones: [zone.id_zone], id_vehicule: vehicule.id_vehicule,
  }, admin), 201).data;

  let tokenLivreur = must('Connexion du livreur (mot de passe temporaire)', await call('POST', '/auth/login', { email: livreur.email, mot_de_passe: livreur.mot_de_passe_initial }), 200).data.token;
  const blocked = await call('GET', '/affectations', null, tokenLivreur);
  check('Routes bloquées tant que le mot de passe est temporaire (403)', blocked.status === 403 && blocked.body.error.code === 'PASSWORD_CHANGE_REQUIRED', blocked.body);
  tokenLivreur = must('Changement du mot de passe du livreur', await call('POST', '/auth/change-password', { ancien_mot_de_passe: livreur.mot_de_passe_initial, nouveau_mot_de_passe: 'Livreur1234' }, tokenLivreur), 200).data.token;

  const clientEmail = `client.${id}@test.local`;
  must('Inscription du client', await call('POST', '/auth/register', { email: clientEmail, nom_utilisateur: `client_${id}`, mot_de_passe: 'Client1234', type_expediteur: 'client', nom_complet: 'Client Test', telephone: '0341111111' }), 201);
  const tokenClient = must('Connexion du client', await call('POST', '/auth/login', { email: clientEmail, mot_de_passe: 'Client1234' }), 200).data.token;

  console.log('--- Demande et affectation');
  const demande = must('Création de la demande', await call('POST', '/demandes', {
    adresse_recuperation: 'Adresse A (test)', latitude_recuperation: pickup.latitude, longitude_recuperation: pickup.longitude,
    adresse_livraison: 'Adresse B (test)', latitude_livraison: dropoff.latitude, longitude_livraison: dropoff.longitude,
    colis: [{ libelle: 'Colis de test', poids_estime: 2 }],
    destinataires: [{ nom: 'Destinataire', telephone: '0342222222' }],
  }, tokenClient), 201).data;
  check('Zone de récupération trouvée par le polygone', demande.id_zone_recuperation === zone.id_zone, demande.zone_recuperation);
  check('Frais estimés calculés', Number(demande.frais_estimes) > 0, demande.frais_estimes);
  const idLivraison = demande.livraison.id_livraison;

  const missions = must('Missions du livreur', await call('GET', '/affectations', null, tokenLivreur), 200);
  const proposition = (missions.data || []).find((a) => a.numero_suivi === demande.numero_suivi && a.statut === 'en_attente');
  if (!check('Proposition automatique reçue par le livreur', Boolean(proposition), missions.data)) {
    throw new Error('Aucune proposition : vérifie le tarif actif, la zone et le livreur (activé, libre, véhicule disponible).');
  }
  must('Acceptation de la mission', await call('POST', `/affectations/${proposition.id_affectation}/accepter`, null, tokenLivreur), 200);

  console.log('--- Exécution de la livraison');
  must('Partage de la position du livreur', await call('POST', '/positions', pickup, tokenLivreur), 200);
  const verification = must('Vérification du colis', await call('POST', `/livraisons/${idLivraison}/verifier`, { colis: demande.colis.map((c) => ({ id_colis: c.id_colis, poids_reel: 2.2 })) }, tokenLivreur), 200);
  check('Frais définitifs calculés', Number(verification.data.frais_definitifs) > 0, verification.data);

  const recuperationAvantPaiement = await call('POST', `/livraisons/${idLivraison}/recuperer`, null, tokenLivreur);
  check('Récupération refusée avant le paiement (409)', recuperationAvantPaiement.status === 409, recuperationAvantPaiement.body);

  const carteInvalide = await call('POST', `/demandes/${demande.id_demande}/paiements`, { mode_paiement: 'carte', numero_carte: '4111 1111 1111 1112', titulaire: 'Client Test', expiration: '12/2035', cryptogramme: '123' }, tokenClient);
  check('Carte invalide : paiement refusé (402)', carteInvalide.status === 402 && carteInvalide.body.error.code === 'PAYMENT_FAILED', carteInvalide.body);
  const paiement = must('Paiement par carte valide', await call('POST', `/demandes/${demande.id_demande}/paiements`, { mode_paiement: 'carte', numero_carte: '4111 1111 1111 1111', titulaire: 'Client Test', expiration: '12/2035', cryptogramme: '123' }, tokenClient), 201);
  check('Reçu généré', /^REC-/.test(paiement.data.recu.numero_recu), paiement.data.recu);

  must('Récupération du colis', await call('POST', `/livraisons/${idLivraison}/recuperer`, null, tokenLivreur), 200);
  const suivi = await call('GET', `/livraisons/${idLivraison}/position`, null, tokenClient);
  check('Le client voit la position du livreur pendant la livraison', suivi.status === 200 && suivi.data.position !== null, suivi.body);
  const itineraire = await call('GET', `/livraisons/${idLivraison}/itineraire`, null, tokenLivreur);
  check('Itinéraire disponible pour le livreur', itineraire.status === 200 && itineraire.data.geometrie, itineraire.body);
  must('Remise au destinataire', await call('POST', `/livraisons/${idLivraison}/livrer`, { id_destinataire: demande.destinataires[0].id_destinataire, methode_verification: 'cin' }, tokenLivreur), 200);

  console.log('--- Résultat et consultation');
  const final = must('Consultation de la demande par le client', await call('GET', `/demandes/${demande.id_demande}`, null, tokenClient), 200);
  check('Demande validée', final.data.statut === 'validee', final.data.statut);
  check('Livraison terminée', final.data.livraison.statut === 'terminee', final.data.livraison.statut);
  check('Historique des statuts complet', final.data.historique.length >= 4, final.data.historique);

  const notifications = await call('GET', '/notifications', null, tokenClient);
  check('Le client a reçu des notifications', notifications.status === 200 && notifications.meta.total >= 3, notifications.meta);
  const tableau = await call('GET', '/statistiques/tableau-de-bord', null, admin);
  check('Tableau de bord administrateur', tableau.status === 200 && tableau.data.demandes.total >= 1, tableau.body);
  const stats = await call('GET', '/statistiques/moi', null, tokenLivreur);
  check('Statistiques personnelles du livreur', stats.status === 200 && stats.data.livraisons.terminees >= 1, stats.body);
  const paiements = await call('GET', `/paiements?q=${demande.numero_suivi}`, null, admin);
  check('Paiements : tentative échouée et paiement validé', paiements.status === 200 && paiements.meta.total >= 2 && paiements.meta.total_valide > 0, paiements.meta);
  const audit = await call('GET', `/audit?type_objet=livraison&id_objet=${idLivraison}`, null, admin);
  check('Journal d\'audit de la livraison', audit.status === 200 && audit.meta.total >= 1, audit.meta);

  console.log('--- Contrôle des droits');
  check('Un livreur ne voit pas les paiements (403)', (await call('GET', '/paiements', null, tokenLivreur)).status === 403);
  check('Un client ne voit pas le tableau de bord (403)', (await call('GET', '/statistiques/tableau-de-bord', null, tokenClient)).status === 403);
  check('Un client ne peut pas valider une affectation (403)', (await call('POST', `/affectations/${proposition.id_affectation}/accepter`, null, tokenClient)).status === 403);
  check('Sans jeton : 401', (await call('GET', '/demandes')).status === 401);
};

run()
  .catch((err) => {
    failed += 1;
    console.error(`\nTest interrompu : ${err.message}`);
  })
  .finally(() => {
    console.log(`\n${passed} réussi(s), ${failed} échec(s)`);
    process.exit(failed > 0 ? 1 : 0);
  });
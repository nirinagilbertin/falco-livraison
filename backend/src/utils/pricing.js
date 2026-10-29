// Calcul des frais de livraison (R14) :
//   frais = frais de base + prix par km × distance + prix par kg × poids
// Chaque terme est arrondi au centième séparément (calcul en centièmes entiers)
// pour éviter les erreurs d'arrondi des nombres décimaux.
const toCents = (amount) => Math.round(Number(amount) * 100);

const computeBreakdown = (tarif, distance_km, poids_kg) => {
  const base = toCents(tarif.frais_base);
  const distance = Math.round(Number(tarif.prix_par_km) * 100 * Number(distance_km));
  const poids = Math.round(Number(tarif.prix_par_kg) * 100 * Number(poids_kg));
  return {
    frais_base: base / 100,
    cout_distance: distance / 100,
    cout_poids: poids / 100,
    total: (base + distance + poids) / 100,
  };
};

const computeFees = (tarif, distance_km, poids_kg) => computeBreakdown(tarif, distance_km, poids_kg).total;

module.exports = { computeFees, computeBreakdown };
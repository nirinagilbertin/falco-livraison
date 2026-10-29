const AppError = require('../utils/AppError');
const zoneRepository = require('../repositories/zone.repository');
const { pointInGeometry } = require('../utils/geo');

// Zone desservie contenant le point, ou null s'il est hors de toute zone.
// Seules les zones actives qui ont des limites géographiques peuvent localiser une adresse.
const locate = async (latitude, longitude) => {
  const zones = await zoneRepository.findActiveWithBoundaries();
  if (zones.length === 0) {
    throw new AppError(
      "Aucune zone desservie n'est configurée : une zone active doit avoir ses limites géographiques (polygone)",
      409,
      'NO_SERVED_ZONE'
    );
  }
  return zones.find((z) => pointInGeometry(longitude, latitude, z.limites_geographiques)) || null;
};

module.exports = { locate };
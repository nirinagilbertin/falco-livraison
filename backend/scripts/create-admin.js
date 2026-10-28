// Crée le premier compte administrateur (avec mot de passe temporaire à changer à la 1re connexion).
// Usage : npm run seed:admin
//    ou : npm run seed:admin -- --email=moi@exemple.mg --password=MotDePasse123 --username=admin
require('../src/config/zod');
const { pool, withTransaction } = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');
const compteRepository = require('../src/repositories/compte.repository');
const utilisateurInterneRepository = require('../src/repositories/utilisateurInterne.repository');
const auditService = require('../src/services/audit.service');
const schemas = require('../src/validators/auth.validator');
const { email: emailSchema } = require('../src/validators/common.validator');

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('='))
);

const config = {
  email: args.email || 'admin@falco.local',
  username: args.username || 'admin',
  password: args.password || 'Admin12345',
  nom: args.nom || 'Administrateur',
  prenom: args.prenom || 'Falco',
  telephone: args.telephone || '0000000000',
};

(async () => {
  try {
    const email = emailSchema.parse(config.email);
    const nom_utilisateur = schemas.nomUtilisateur.parse(config.username);
    const password = schemas.motDePasse.parse(config.password);

    if (await compteRepository.existsByEmail(email) || await compteRepository.existsByUsername(nom_utilisateur)) {
      console.log('Un compte existe déjà avec cet e-mail ou ce nom d\'utilisateur : rien n\'a été créé.');
      return;
    }

    const mot_de_passe_hash = await hashPassword(password);
    const id = await withTransaction(async (conn) => {
      const id_compte = await compteRepository.create(conn, {
        email, nom_utilisateur, mot_de_passe_hash, role: 'administrateur', mot_de_passe_temporaire: 1,
      });
      await utilisateurInterneRepository.create(conn, {
        id_compte, nom: config.nom, prenom: config.prenom, telephone: config.telephone,
      });
      await auditService.log(
        { id_compte: null, action: 'creation_compte', type_objet: 'compte', id_objet: id_compte, details: 'administrateur initial (script)' },
        conn
      );
      return id_compte;
    });

    console.log(`Administrateur créé (id_compte=${id}).`);
    console.log(`  e-mail       : ${email}`);
    console.log(`  mot de passe : ${password}  (temporaire : à changer à la première connexion)`);
  } catch (err) {
    console.error('Échec :', err.issues ? err.issues.map((i) => i.message).join(' | ') : err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
// Simulation réaliste d'un paiement (aucune transaction financière réelle).
// Les informations sont vérifiées ; fausses ou non conformes, le paiement échoue avec un motif.
// Seules des informations masquées sont renvoyées pour être conservées : jamais de numéro de carte complet ni de cryptogramme.

const OPERATEURS = {
  mvola: { label: 'MVola', prefixes: ['034', '038'] },
  orange_money: { label: 'Orange Money', prefixes: ['032', '037'] },
  airtel_money: { label: 'Airtel Money', prefixes: ['033'] },
};

// Algorithme de Luhn (somme de contrôle des numéros de carte)
const luhnValid = (digits) => {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

const fail = (motif, masked = {}) => ({ ok: false, motif, masked });

const simulateCard = ({ numero_carte, titulaire, expiration, cryptogramme }) => {
  const digits = String(numero_carte).replace(/[\s-]/g, '');
  const last4 = /^\d+$/.test(digits) && digits.length >= 4 ? digits.slice(-4) : null;
  const masked = { carte_derniers_chiffres: last4, titulaire_carte: String(titulaire).trim().slice(0, 100) };

  if (!/^\d{13,19}$/.test(digits)) return fail('Numéro de carte non conforme (13 à 19 chiffres attendus)', masked);
  if (!luhnValid(digits)) return fail('Numéro de carte invalide', masked);

  const match = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/.exec(String(expiration).trim());
  if (!match) return fail("Date d'expiration non conforme (format MM/AA)", masked);
  const month = Number(match[1]);
  const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
  if (month < 1 || month > 12) return fail("Date d'expiration invalide", masked);
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return fail('Carte expirée', masked);

  if (!/^\d{3,4}$/.test(String(cryptogramme).trim())) return fail('Cryptogramme invalide (3 ou 4 chiffres)', masked);

  // Cartes de test : permettent de simuler un refus de la banque
  if (digits.endsWith('0002')) return fail('Paiement refusé par la banque (carte de test)', masked);
  if (digits.endsWith('9995')) return fail('Fonds insuffisants (carte de test)', masked);

  return { ok: true, motif: null, masked };
};

const simulateMobileMoney = ({ operateur, numero }) => {
  const op = OPERATEURS[String(operateur).trim().toLowerCase()];
  const normalized = String(numero).replace(/[\s.-]/g, '').replace(/^(\+261|261)/, '0');
  const masked = {
    operateur_mobile: op ? op.label : String(operateur).trim().slice(0, 50),
    numero_payeur: /^\d{10}$/.test(normalized) ? `${normalized.slice(0, 3)}****${normalized.slice(-2)}` : null,
  };

  if (!op) return fail('Opérateur non pris en charge (mvola, orange_money ou airtel_money)', masked);
  if (!/^03[2-9]\d{7}$/.test(normalized)) return fail('Numéro de téléphone invalide', masked);
  if (!op.prefixes.some((p) => normalized.startsWith(p))) return fail(`Ce numéro n'est pas un numéro ${op.label}`, masked);
  if (normalized.endsWith('0000')) return fail('Solde insuffisant (numéro de test)', masked);

  return { ok: true, motif: null, masked };
};

const simulatePayment = (payload) =>
  payload.mode_paiement === 'carte' ? simulateCard(payload) : simulateMobileMoney(payload);

module.exports = { simulatePayment, OPERATEURS };
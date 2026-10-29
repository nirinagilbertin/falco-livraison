const crypto = require('crypto');

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // sans I, l, O pour éviter les confusions
const DIGITS = '23456789'; // sans 0 et 1

const pick = (alphabet) => alphabet[crypto.randomInt(alphabet.length)];

// 10 caractères : 8 lettres + 2 chiffres mélangés (respecte la politique de mot de passe)
const generateTemporaryPassword = () => {
  const chars = [...Array(8)].map(() => pick(LETTERS)).concat([...Array(2)].map(() => pick(DIGITS)));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

module.exports = { generateTemporaryPassword };
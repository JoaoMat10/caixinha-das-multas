const usernamePattern = /^[a-z0-9._-]{3,32}$/;
const base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return usernamePattern.test(normalizeUsername(username));
}

function encodeBase32(value: string) {
  const bytes = new TextEncoder().encode(value);
  let accumulator = 0;
  let availableBits = 0;
  let encoded = '';

  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    availableBits += 8;
    while (availableBits >= 5) {
      availableBits -= 5;
      encoded += base32Alphabet[(accumulator >> availableBits) & 31];
    }
  }
  if (availableBits > 0) {
    encoded += base32Alphabet[(accumulator << (5 - availableBits)) & 31];
  }
  return encoded;
}

export function usernameToTechnicalEmail(username: string) {
  const normalizedUsername = normalizeUsername(username);
  if (!usernamePattern.test(normalizedUsername))
    throw new Error('Username inválido.');
  return `u-${encodeBase32(normalizedUsername)}@auth.caixinha.invalid`;
}

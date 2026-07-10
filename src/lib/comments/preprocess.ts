const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;
const MENTION_PATTERN = /(^|\s)@[\w.]+/g;
const EXTRA_WHITESPACE_PATTERN = /\s+/g;

export function cleanCommentText(text: string) {
  return text
    .replace(URL_PATTERN, " ")
    .replace(MENTION_PATTERN, " ")
    .replace(EXTRA_WHITESPACE_PATTERN, " ")
    .trim();
}

export function isLikelySpam(text: string) {
  const normalized = text.toLowerCase();
  const spamPatterns = [
    /follow\s*back|follback|fb dong/,
    /cek\s*(dm|bio|profil)/,
    /gratis\s*ongkir|promo\s*besar|diskon\s*besar/,
    /giveaway|hadiah|menang\s*iphone/,
    /open\s*bo|slot\s*gacor|jud[iy]|casino/,
    /wa\s*\d{6,}|whatsapp\s*\d{6,}/,
  ];

  if (!normalized.trim()) {
    return true;
  }

  return spamPatterns.some((pattern) => pattern.test(normalized));
}

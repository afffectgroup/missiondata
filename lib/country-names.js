/**
 * Mapping country code → noms du pays dans plusieurs langues
 * Critique pour le post-filter des adresses LinkedIn qui sont en LANGUE LOCALE :
 * - Allemagne → "Deutschland"
 * - Belgique (FR) → "Belgique" / (NL) → "België"
 * - Suisse → "Schweiz" (DE) / "Suisse" (FR) / "Svizzera" (IT)
 *
 * On n'utilise JAMAIS l'alpha-2 seul ("DE", "FR") pour matcher l'adresse :
 * "de" en lowercase match "Île-de-France" et pollue tout.
 */
export const COUNTRY_NAMES = {
  'FR': ['France'],
  'DE': ['Deutschland', 'Germany', 'Allemagne'],
  'GB': ['United Kingdom', 'England', 'Scotland', 'Wales', 'Royaume-Uni'],
  'US': ['United States', 'USA', 'U.S.A.', 'America', 'États-Unis', 'Etats-Unis'],
  'ES': ['España', 'Spain', 'Espagne'],
  'IT': ['Italia', 'Italy', 'Italie'],
  'BE': ['Belgique', 'België', 'Belgium'],
  'NL': ['Nederland', 'Netherlands', 'Pays-Bas'],
  'CH': ['Schweiz', 'Suisse', 'Svizzera', 'Switzerland'],
  'LU': ['Luxembourg', 'Lëtzebuerg'],
  'PT': ['Portugal'],
  'AT': ['Österreich', 'Austria', 'Autriche'],
  'SE': ['Sverige', 'Sweden', 'Suède'],
  'DK': ['Danmark', 'Denmark', 'Danemark'],
  'FI': ['Suomi', 'Finland', 'Finlande'],
  'NO': ['Norge', 'Norway', 'Norvège'],
  'IE': ['Ireland', 'Éire', 'Irlande'],
  'CA': ['Canada'],
  'AU': ['Australia', 'Australie'],
  'MA': ['Maroc', 'Morocco', 'Al-Maghrib'],
  'TN': ['Tunisie', 'Tunisia'],
  'DZ': ['Algérie', 'Algeria'],
}

export function countryDisplayNames(code) {
  if (!code) return []
  return COUNTRY_NAMES[code.toUpperCase()] || [code]
}

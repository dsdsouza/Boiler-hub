// Only verified app hosts may receive the synthetic accounts' session cookies.
export const TRUSTED_ACCOUNT_ORIGINS = Object.freeze([
  'https://boilerplate.select',
  'https://boilerhub.work',
  'https://boilerplate.zhomander.workers.dev',
]);

export const isTrustedAccountOrigin = (origin) => TRUSTED_ACCOUNT_ORIGINS.includes(origin);

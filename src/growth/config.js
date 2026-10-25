const env = import.meta.env ?? {};
export const GROWTH_API = env.VITE_GROWTH_API_URL ??
  'https://api.plusvibegames.com/magnet-sort-growth/v1';
export const BUILD_TARGET = typeof __MAGNET_TARGET__ === 'string' ? __MAGNET_TARGET__ : 'web';
export const BUILD_REVISION = typeof __MAGNET_REVISION__ === 'string' ? __MAGNET_REVISION__ : 'development';
export const TELEMETRY_ALLOWED = ['web', 'telegram'].includes(BUILD_TARGET);
export const ENVIRONMENT = env.PROD ? 'production' : 'qa';
export const ADS_ENABLED = env.VITE_ADS_ENABLED === 'true';
export const AD_MODE = env.VITE_CRAZYGAMES_LAUNCH === 'full' ? 'full' :
  BUILD_TARGET === 'crazygames' ? 'basic' : 'full';

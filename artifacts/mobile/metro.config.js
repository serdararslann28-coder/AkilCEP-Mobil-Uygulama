const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const rewriteExpoRequestUrl = config.server.rewriteRequestUrl;

// /_expo/loading is Expo's HTML launcher, not an application module.
// A dev client opened with that URL can fall back to requesting it as a
// native bundle. Resolve only that fallback through Expo's normal entry
// resolver, preserving platform, Hermes and Router transform options.
config.server.rewriteRequestUrl = (requestUrl) => {
  const url = new URL(requestUrl, 'http://metro.local');
  const platform = url.searchParams.get('platform');

  if (
    url.pathname === '/_expo/loading.bundle' &&
    (platform === 'android' || platform === 'ios')
  ) {
    url.pathname = '/.expo/.virtual-metro-entry.bundle';
    requestUrl = requestUrl.startsWith('/')
      ? `${url.pathname}${url.search}`
      : url.toString();
  }

  return rewriteExpoRequestUrl(requestUrl);
};

module.exports = config;

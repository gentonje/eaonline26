const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  port: 5000,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('X-Forwarded-Host', '*');
      return middleware(req, res, next);
    };
  },
};

const localDir = path.join(__dirname, '.local');
config.watchFolders = (config.watchFolders || []).filter(f => !f.startsWith(localDir));

config.resolver = {
  ...config.resolver,
  blockList: [
    ...(config.resolver?.blockList ? (Array.isArray(config.resolver.blockList) ? config.resolver.blockList : [config.resolver.blockList]) : []),
    new RegExp(`${localDir.replace(/[/\\]/g, '[/\\\\]')}.*`),
  ],
};

module.exports = withNativeWind(config, { input: "./global.css" });

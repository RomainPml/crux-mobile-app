const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the shared package source for live updates
config.watchFolders = [monorepoRoot];

// Resolve modules from both the app and the monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// Make sure we don't have duplicate React instances
config.resolver.disableHierarchicalLookup = true;

module.exports = config;

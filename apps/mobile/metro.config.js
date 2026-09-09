// Metro config for the Expo app inside a pnpm monorepo.
// Follows Expo's monorepo guide: watch the workspace root and resolve modules
// from both the app and the root node_modules. disableHierarchicalLookup is
// required for pnpm's isolated (symlinked) node_modules layout.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo (so changes to packages/core are picked up)
config.watchFolders = [workspaceRoot];

// 2. Resolve node_modules from the app first, then the workspace root
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

// Note: with pnpm nodeLinker=hoisted (see pnpm-workspace.yaml) node_modules is
// flat, so we do NOT set resolver.disableHierarchicalLookup — Expo's default
// (false) is correct and expo-doctor flags overriding it as risky.

module.exports = config;

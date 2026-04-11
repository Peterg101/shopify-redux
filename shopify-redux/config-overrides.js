module.exports = function override(config) {
  // Excalidraw's dependency roughjs uses ESM with extensionless imports.
  // CRA5's webpack 5 config treats .mjs / ESM as fullySpecified by default,
  // which breaks "roughjs/bin/rough" → needs "rough.js".
  // This rule tells webpack to allow extensionless imports from these packages.
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: { fullySpecified: false },
  });

  return config;
};

module.exports = {
  root: true,
  ignorePatterns: ['node_modules/'],
  env: {
    browser: true,
    es2022: true,
  },
  parserOptions: {
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': 'off',
  },
  overrides: [
    {
      files: ['tests/**/*.mjs'],
      env: {
        node: true,
        browser: false,
      },
      parserOptions: {
        sourceType: 'module',
      },
    },
  ],
};

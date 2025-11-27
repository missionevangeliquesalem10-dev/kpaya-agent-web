module.exports = {
  // Indique à ESLint de ne pas chercher de configuration parentes au-dessus de ce dossier.
  root: true, 
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    // Règles pour les Cloud Functions
    quotes: ['error', 'single'],
    // Autoriser l'utilisation des console.log pour le debug
    'no-console': 'off',
    // Permet l'utilisation des 'await' sans être dans une fonction 'async' immédiate
    'no-unused-expressions': 'off', 
    '@typescript-eslint/no-unused-expressions': ['error'],
    
  },
};
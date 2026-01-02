module.exports = [
  {
    languageOptions: {
      globals: {
        browser: 'readonly',
        es2021: 'readonly',
        node: 'readonly',
        document: 'readonly',
        window: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        module: 'readonly'
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-undef': 'warn',
      'no-unused-vars': 'warn',
      'no-console': 'off',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single']
    }
  }
];
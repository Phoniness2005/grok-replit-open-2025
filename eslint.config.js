import js from '@eslint/js';
import globals from 'globals';

const shared = {
  'no-var': 'error',
  'prefer-const': 'error',
  eqeqeq: ['error', 'always'],
  curly: ['error', 'all'],
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  'no-caller': 'error',
  'no-extend-native': 'error',
  'no-proto': 'error',
  'no-with': 'error',
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'all' }],
  'no-implicit-globals': 'error',
  'no-global-assign': 'error',
  'no-labels': 'error',
  'no-extra-bind': 'error',
  'no-iterator': 'error',
  'no-new-wrappers': 'error',
  'no-array-constructor': 'error',
  'no-object-constructor': 'error',
  'no-return-assign': 'error',
  'no-self-compare': 'error',
  'no-sequences': 'error',
  'no-throw-literal': 'error',
  'no-unmodified-loop-condition': 'error',
  'no-unused-expressions': 'error',
  'no-useless-call': 'error',
  'no-useless-concat': 'error',
  'no-useless-return': 'error',
  'no-void': 'error',
  'no-loop-func': 'error',
  'no-inner-declarations': 'error',
  radix: 'error',
  yoda: 'error',
  'max-lines-per-function': ['error', {
    max: 60,
    skipBlankLines: true,
    skipComments: true,
    IIFEs: true
  }],
  'no-restricted-properties': ['error',
    {
      property: 'innerHTML',
      message: 'Rule 8: build DOM nodes at init instead of parsing HTML strings.'
    },
    {
      property: 'outerHTML',
      message: 'Rule 8: build DOM nodes at init instead of parsing HTML strings.'
    },
    {
      property: 'insertAdjacentHTML',
      message: 'Rule 8: build DOM nodes at init instead of parsing HTML strings.'
    }
  ]
};

const controlFlow = {
  'no-restricted-syntax': ['error',
    {
      selector: 'WhileStatement',
      message: 'Rule 2: use a for loop whose upper bound is a constant.'
    },
    {
      selector: 'DoWhileStatement',
      message: 'Rule 2: use a for loop whose upper bound is a constant.'
    },
    {
      selector: 'ForInStatement',
      message: 'Rule 2: for-in has no static iteration cap.'
    },
    {
      selector: 'ForOfStatement',
      message: 'Rule 2: for-of has no static iteration cap.'
    },
    {
      selector: 'WithStatement',
      message: 'Rule 1: with is not allowed.'
    },
    {
      selector: 'CallExpression[callee.name="eval"]',
      message: 'Rule 8: eval is not allowed.'
    },
    {
      selector: 'NewExpression[callee.name="Function"]',
      message: 'Rule 8: the Function constructor is not allowed.'
    },
    {
      selector: 'CallExpression[callee.type="MemberExpression"][callee.computed=true]',
      message: 'Rule 9: do not call through a computed property. Use a direct call.'
    }
  ]
};

export default [
  {
    ignores: ['node_modules/**']
  },
  js.configs.recommended,
  {
    files: ['shared/**/*.js', 'v1/**/*.js', 'v2/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.browser
    },
    rules: {
      ...shared,
      ...controlFlow
    }
  },
  {
    files: ['tools/**/*.mjs', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node
    },
    rules: shared
  }
];

import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  // Game source — browser environment
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // --- Correctness ---
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-console': 'warn',

      // --- Style ---
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',

      // --- Vue: enforce script-setup ---
      'vue/component-api-style': ['error', ['script-setup']],
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error',

      // --- Vue: disable formatting rules (handled by dev preference, not lint) ---
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
    },
  },

  // Tests — node globals, relaxed rules
  {
    files: ['src/tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  {
    ignores: ['dist/', 'node_modules/'],
  },
]

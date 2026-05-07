/* eslint-disable @typescript-eslint/no-var-requires */
const { getTokenVariable, convertTokensToMap, getBreakpoints } = require('./utilities/postcss-functions');

const plugins = {
  'postcss-functions': {
    functions: {
      token(path) {
        return getTokenVariable(path);
      },
      'map-breakpoints'() {
        return getBreakpoints();
      },
      'map-tokens'(path) {
        return convertTokensToMap(path);
      },
    },
  },
  'postcss-each': { preserve: false },
  'postcss-flexbugs-fixes': {},
  'postcss-preset-env': {
    autoprefixer: {
      flexbox: 'no-2009',
    },
    stage: 3,
    features: {
      'custom-properties': false,
    },
  },
};

module.exports = { plugins };

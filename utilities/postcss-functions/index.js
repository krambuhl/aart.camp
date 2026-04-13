/* eslint-disable @typescript-eslint/no-var-requires */

const tokenReferenceObject = require('./token-reference-object.json');
const tokenReferences = require('./token-reference.json');
const tokenValuesObject = require('./token-values-object.json');

function getTokenKey(path) {
  return path.replace(/"/g, '');
}

/**
 * Gets the css variable for the token at the given path. If the path provided
 * does not contain a valid variable, an error will be thrown.
 *
 * @param {string} path – dot-separated path to the token in the `tokens` object.
 * @returns {string} The variable name for the token at the given path.
 *
 * Example output: "var(--primary-action-default)"
 */
function getTokenVariable(keyPath) {
  // parse the path to remove any quotes
  const referenceKey = getTokenKey(keyPath);

  // get the token value object for the given path
  const tokenValue = tokenReferences[referenceKey];

  // if the token value is a valid variable, return it
  if (tokenValue) {
    return tokenValue;
  }

  // otherwise we should throw an error
  throw new Error(`No variable found for token at path: ${keyPath}`);
}

/**
 * Converts a group of tokens at a specified path into a combined string of keys and values.
 * This string can be used with the `@each` at-rule within a CSS stylesheet.
 *
 * @param {string} path – the dot-separated path to the token group in the `tokens` object.
 * @returns {string} A combined string of keys and values for the token group.
 *
 * Example output: "(path-key1,path-key2),(value1,value2)"
 */
function convertTokensToMap(keyPath) {
  // parse the path to remove any quotes
  const referenceKey = getTokenKey(keyPath);

  // get the group of tokens for the given keyPath
  const tokenGroup = referenceKey.split('.').reduce((obj, key) => obj[key], tokenReferenceObject);

  // get the values of the tokens
  const keys = Object.keys(tokenGroup);
  const values = Object.values(tokenGroup);

  // merge the keys and values into a string
  // which we can use with the `@each` at-rule
  const keysString = `(${keys.join(',')})`;
  const valuesString = `(${values.join(',')})`;

  // return the combined string
  return [keysString, valuesString].join(',');
}

/**
 * Gets the breakpoints from the design tokens in a format that can be
 * used with the `@each` at-rule within a CSS stylesheet.
 *
 * @returns {string} A combined string of keys and values for the breakpoints.
 *
 * Example output: "(path-key1,path-key2),(value1,value2)"
 */
function getBreakpoints() {
  // get the group of tokens for the given path
  const tokenGroup = tokenValuesObject.breakpoint;

  // get the keys with the path prefixing the names
  const keys = Object.keys(tokenGroup);

  // get the values of the tokens
  const values = Object.values(tokenGroup).map((def) => `(min-width: ${def})`);

  // merge the keys and values into a string
  // which we can use with the `@each` at-rule
  const keysString = `(${keys.join(',')})`;
  const valuesString = `(${values.join(',')})`;

  // return the combined string
  return [keysString, valuesString].join(',');
}

module.exports = {
  getTokenVariable,
  convertTokensToMap,
  getBreakpoints,
};

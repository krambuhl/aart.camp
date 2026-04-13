import fs from 'node:fs';
import path from 'node:path';
import setValue from 'set-value';

import designTokens from '../tokens/design-tokens.json' with { type: 'json' };

type ValueObject = { value: string; 'value@dark'?: string };
type TokenPair = [string, ValueObject];

interface TokenInput<T> {
  [key: string]: TokenInput<T> | T;
}

interface TokenOutput {
  [key: string]: ValueObject | string;
}

function extractFlattenedTokens(input: TokenInput<ValueObject>): TokenPair[] {
  const flatPairs: TokenPair[] = [];

  const buildVariables = (tokens: TokenInput<ValueObject>, prevNamespace = '') => {
    for (const key in tokens) {
      const value = tokens[key];

      if (typeof value === 'object') {
        if ('value' in value) {
          flatPairs.push([`${prevNamespace}${key}`, value as ValueObject]);
        } else {
          buildVariables(value, `${prevNamespace}${key}.`);
        }
      }
    }
  };

  // kick off the recursive function
  buildVariables(input);

  return flatPairs;
}

function generateTokenName(key: string) {
  return `--${key.replace(/\./g, '-')}`;
}

function generateTokenReferenceObject(tokenPairs: TokenPair[]) {
  const tokenReference: Record<string, string> = {};

  tokenPairs.forEach(([key]) => {
    tokenReference[key] = `var(${generateTokenName(key)})`;
  });

  return tokenReference;
}

function generateTokenValueObject(tokenPairs: TokenPair[]) {
  const tokenValues: TokenOutput = {};

  tokenPairs.forEach(([key, value]) => {
    setValue(tokenValues, key, value.value);
  });

  return tokenValues;
}

function generateTokenVariableObject(tokenPairs: TokenPair[]) {
  const tokenVariables: TokenOutput = {};

  tokenPairs.forEach(([key]) => {
    setValue(tokenVariables, key, `var(${generateTokenName(key)})`);
  });

  return tokenVariables;
}

function generateTokensObjectString(tokenVariables: TokenOutput) {
  const variablesJson = JSON.stringify(tokenVariables, null, 2);
  const variablesOutput = `export const tokens = ${variablesJson} as const;`;
  return variablesOutput;
}

function generateBreakpointsInPixelsObject(tokenVariables: TokenOutput) {
  return Object.entries(tokenVariables.breakpoint).reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = parseInt(value, 10);
    return acc;
  }, {});
}

function generateBreakpointNamesArray(breakpointsInPixels: Record<string, number>) {
  return Object.entries(breakpointsInPixels)
    .sort(([, a], [, b]) => a - b) // sort from smallest to largest
    .map(([name]) => `"${name}"`);
}

function generateBreakpointsObjectString(tokenVariables: TokenOutput) {
  const breakpointsInPixels = generateBreakpointsInPixelsObject(tokenVariables);
  const breakpointsInPixelsJson = JSON.stringify(breakpointsInPixels, null, 2);
  return `import { Responsive } from "utilities/opaque-responsive";
  
export const breakpoints: Required<Responsive<number>> = ${breakpointsInPixelsJson};`;
}

function generateBreakpointsUtilitiesString(tokenVariables: TokenOutput) {
  const breakpointsInPixels = generateBreakpointsInPixelsObject(tokenVariables);
  const breakpointNames = generateBreakpointNamesArray(breakpointsInPixels);

  const breakpointsInPixelsJson = JSON.stringify(breakpointsInPixels, null, 2);

  const output = `import { Breakpoint, Responsive } from './opaque-responsive';

/**
 * This is a helper object that contains the pixel values for each breakpoint.
 * @internal This is exposed for testing purposes, and should not be used directly.
 */
export const breakpointsInPixels: Required<Responsive<number>> = ${breakpointsInPixelsJson};

/**
 * This is a helper array that contains the names of each breakpoint in order
 * from smallest to largest.
 */
export const breakpointNames: Breakpoint[] = [${breakpointNames.join(', ')}];
`;

  return output;
}

function generateCssTokenString(tokenPairs: TokenPair[]) {
  // create the token variables object
  const tokenValues: Array<[string, string]> = [];
  const tokenDarkValues: Array<[string, string]> = [];

  // loop through the token pairs and build the token variables object
  tokenPairs.forEach(([key, value]) => {
    const tokenName = generateTokenName(key);

    tokenValues.push([tokenName, value.value]);
    if (value['value@dark']) {
      tokenDarkValues.push([tokenName, value['value@dark']]);
    }
  });

  // generate css output
  return (
    ':root {\n' +
    tokenValues.map(([key, value]) => `  ${key}: ${value};`).join('\n') +
    '\n}\n\n' +
    '@media (prefers-color-scheme: dark) {\n' +
    '  :root {\n' +
    tokenDarkValues.map(([key, value]) => `    ${key}: ${value};`).join('\n') +
    '\n  }' +
    '\n}\n'
  );
}

function addGeneratedHeader(value: string) {
  return `/* DO NOT EDIT */\n/* This file was automatically generated at ${new Date().toLocaleString()} */\n\n${value}`;
}

function writeFile(filepath: string, content: string) {
  const directory = path.dirname(filepath);
  fs.mkdirSync(directory, { recursive: true });

  console.log(`writing ${path.relative(process.cwd(), filepath)}`);
  fs.writeFileSync(filepath, content);
}

// program:
(async function program() {
  // define the output directories
  const OUTPUT_TOKENS_DIR = path.join(process.cwd(), 'tokens');
  const OUTPUT_POSTCSS_FUNCTIONS_DIR = path.join(process.cwd(), 'utilities', 'postcss-functions');
  const OUTPUT_STYLES_DIR = path.join(process.cwd(), 'styles');
  const OUTPUT_UTILS_DIR = path.join(process.cwd(), 'utilities');

  // extract the flattened tokens as an array of [path, { value, value@dark }] pairs
  const tokenPairs = extractFlattenedTokens(designTokens);

  // generate output strings
  const tokenVariables = generateTokenVariableObject(tokenPairs);
  const tokenReference = generateTokenReferenceObject(tokenPairs);
  const tokenValues = generateTokenValueObject(tokenPairs);
  const tokenObject = generateTokensObjectString(tokenVariables);
  const breakpointsObject = generateBreakpointsObjectString(tokenValues);
  const breakpointsUtility = generateBreakpointsUtilitiesString(tokenValues);
  const cssOutput = generateCssTokenString(tokenPairs);

  // write ts output
  writeFile(path.join(OUTPUT_STYLES_DIR, 'tokens.css'), addGeneratedHeader(cssOutput));
  writeFile(path.join(OUTPUT_TOKENS_DIR, 'tokens.ts'), addGeneratedHeader(tokenObject));
  writeFile(path.join(OUTPUT_TOKENS_DIR, 'breakpoints.ts'), addGeneratedHeader(breakpointsObject));
  writeFile(path.join(OUTPUT_UTILS_DIR, 'breakpoints.ts'), addGeneratedHeader(breakpointsUtility));
  writeFile(path.join(OUTPUT_POSTCSS_FUNCTIONS_DIR, 'token-reference.json'), JSON.stringify(tokenReference, null, 2));
  writeFile(path.join(OUTPUT_POSTCSS_FUNCTIONS_DIR, 'token-values-object.json'), JSON.stringify(tokenValues, null, 2));
  writeFile(path.join(OUTPUT_POSTCSS_FUNCTIONS_DIR, 'token-reference-object.json'), JSON.stringify(tokenVariables, null, 2));
})();

// check-nextjs.ts — static analyzer for Next.js antipatterns.
//
// Invocation:
//   node ./scripts/check-nextjs.ts          # walk default scope; findings to stderr, exit 1 if any
//   node ./scripts/check-nextjs.ts --json   # JSON array on stdout, exit 0 regardless
//
// Detects, via TypeScript compiler API + targeted JSX-node inspection:
//   - 'use client' missing on a file that uses client features (hooks, JSX event
//     handlers, browser-only API references)
//   - 'use client' vacuous on a file with no client features (with p5-sketch
//     exception: files importing '@p5-wrapper/react' or rendering <Sketch>
//     legitimately need 'use client' even without direct browser-API references)
//   - <img> JSX (next/image's <Image> preferred)
//   - <a href="/..."> JSX for internal navigation (next/link's <Link> preferred)
//   - getServerSideProps / getStaticProps in app/ (Pages-Router API, deprecated)
//   - <head> JSX in app/ (App Router metadata API preferred)
//
// Source is erasable TypeScript per L-001 — no enums, no namespaces, no
// parameter properties, no const enum. Node 24 strips type annotations natively.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import ts from 'typescript';

interface Finding {
  file: string;
  line: number;
  code: string;
  message: string;
}

const ROOT = process.cwd();
const SCOPE_DIRS = ['app', 'components', 'sketches'] as const;
const HOOK_PATTERN = /^use[A-Z]/;
const EVENT_HANDLER_PATTERN = /^on[A-Z]/;
const BROWSER_GLOBALS = new Set(['window', 'document', 'localStorage', 'sessionStorage', 'navigator']);

function walkScope(rootDir: string): string[] {
  const out: string[] = [];
  for (const dir of SCOPE_DIRS) {
    const start = join(rootDir, dir);
    try {
      walkDir(start, out);
    } catch {
      // Directory may not exist; skip silently.
    }
  }
  return out;
}

function walkDir(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkDir(full, out);
      continue;
    }
    if (entry.endsWith('.tsx') || entry.endsWith('.jsx')) {
      out.push(full);
    }
  }
}

function hasUseClientDirective(sf: ts.SourceFile): boolean {
  // 'use client' must be the first statement, a bare string-literal
  // expression. TypeScript wraps it in an ExpressionStatement.
  const first = sf.statements[0];
  if (!first || !ts.isExpressionStatement(first)) return false;
  const expr = first.expression;
  if (!ts.isStringLiteral(expr) && !ts.isNoSubstitutionTemplateLiteral(expr)) return false;
  return expr.text === 'use client';
}

interface AstSignals {
  usesHooks: boolean;
  usesEventHandlers: boolean;
  usesBrowserGlobals: boolean;
  importsP5Wrapper: boolean;
  rendersSketchComponent: boolean;
  imgElements: { line: number }[];
  internalAnchors: { line: number }[];
  headElements: { line: number }[];
  pagesRouterHooks: { line: number; name: string }[];
}

function analyzeAst(sf: ts.SourceFile): AstSignals {
  const signals: AstSignals = {
    usesHooks: false,
    usesEventHandlers: false,
    usesBrowserGlobals: false,
    importsP5Wrapper: false,
    rendersSketchComponent: false,
    imgElements: [],
    internalAnchors: [],
    headElements: [],
    pagesRouterHooks: [],
  };

  const getLine = (pos: number): number => sf.getLineAndCharacterOfPosition(pos).line + 1;

  function visit(node: ts.Node): void {
    // Hook call: CallExpression with Identifier matching /^use[A-Z]/.
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && HOOK_PATTERN.test(node.expression.text)) {
      signals.usesHooks = true;
    }

    // JSX event handler attribute: name matches /^on[A-Z]/.
    if (ts.isJsxAttribute(node) && node.name && ts.isIdentifier(node.name) && EVENT_HANDLER_PATTERN.test(node.name.text)) {
      signals.usesEventHandlers = true;
    }

    // Browser global reference: Identifier text in the set, when used as a value
    // (not in a type position, not a property name).
    if (ts.isIdentifier(node) && BROWSER_GLOBALS.has(node.text)) {
      const parent = node.parent;
      const isValueRef =
        // X.foo — X is the identifier (left side of access)
        (ts.isPropertyAccessExpression(parent) && parent.expression === node) ||
        // X() — call site
        (ts.isCallExpression(parent) && parent.expression === node) ||
        // typeof X
        ts.isTypeOfExpression(parent);
      if (isValueRef) signals.usesBrowserGlobals = true;
    }

    // Import: '@p5-wrapper/react' triggers p5-sketch exception.
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text.includes('@p5-wrapper/react')) signals.importsP5Wrapper = true;
    }

    // JSX element inspection.
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName;
      if (ts.isIdentifier(tagName)) {
        const name = tagName.text;
        if (name === 'Sketch') signals.rendersSketchComponent = true;
        if (name === 'img') signals.imgElements.push({ line: getLine(node.pos) });
        if (name === 'head') signals.headElements.push({ line: getLine(node.pos) });
        if (name === 'a') {
          // Look for href="/..." attribute.
          for (const attr of node.attributes.properties) {
            if (!ts.isJsxAttribute(attr) || !attr.name || !ts.isIdentifier(attr.name)) continue;
            if (attr.name.text !== 'href') continue;
            const init = attr.initializer;
            if (!init || !ts.isStringLiteral(init)) continue;
            if (init.text.startsWith('/') && !init.text.startsWith('//')) {
              signals.internalAnchors.push({ line: getLine(node.pos) });
            }
          }
        }
      }
    }

    // Pages-Router data-fetching functions.
    if (ts.isFunctionDeclaration(node) && node.name) {
      if (node.name.text === 'getServerSideProps' || node.name.text === 'getStaticProps') {
        signals.pagesRouterHooks.push({ line: getLine(node.pos), name: node.name.text });
      }
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name) && (decl.name.text === 'getServerSideProps' || decl.name.text === 'getStaticProps')) {
          signals.pagesRouterHooks.push({ line: getLine(decl.pos), name: decl.name.text });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);
  return signals;
}

export function analyzeFile(filePath: string, source: string): Finding[] {
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const rel = relative(ROOT, filePath) || filePath;
  const signals = analyzeAst(sf);
  const hasDirective = hasUseClientDirective(sf);
  const findings: Finding[] = [];

  const usesClientFeatures = signals.usesHooks || signals.usesEventHandlers || signals.usesBrowserGlobals;
  const isSketchFile = signals.importsP5Wrapper || signals.rendersSketchComponent || rel.startsWith('sketches/') || rel.startsWith('sketches\\');

  if (usesClientFeatures && !hasDirective) {
    findings.push({
      file: rel,
      line: 1,
      code: 'nextjs-use-client-missing',
      message: "file uses client features (hooks / JSX event handlers / browser APIs) but lacks 'use client' directive",
    });
  }
  if (hasDirective && !usesClientFeatures && !isSketchFile) {
    findings.push({
      file: rel,
      line: 1,
      code: 'nextjs-use-client-vacuous',
      message: "file has 'use client' directive but uses no client features (and is not a p5-sketch component)",
    });
  }

  const isAppOrComponents = rel.startsWith('app/') || rel.startsWith('app\\') || rel.startsWith('components/') || rel.startsWith('components\\');
  const isAppDir = rel.startsWith('app/') || rel.startsWith('app\\');

  if (isAppOrComponents) {
    for (const hit of signals.imgElements) {
      findings.push({
        file: rel,
        line: hit.line,
        code: 'nextjs-img-not-image',
        message: '<img> element should be <Image> from next/image for automatic optimization',
      });
    }
    for (const hit of signals.internalAnchors) {
      findings.push({
        file: rel,
        line: hit.line,
        code: 'nextjs-anchor-not-link',
        message: '<a href="/..."> for internal navigation should be <Link> from next/link for client-side routing',
      });
    }
  }

  if (isAppDir) {
    for (const hit of signals.pagesRouterHooks) {
      findings.push({
        file: rel,
        line: hit.line,
        code: 'nextjs-pages-router-api',
        message: `${hit.name} is a Pages Router API and does not work in App Router files; use route handlers or server components`,
      });
    }
    for (const hit of signals.headElements) {
      findings.push({
        file: rel,
        line: hit.line,
        code: 'nextjs-head-not-metadata',
        message: '<head> JSX in App Router files should be the metadata export instead',
      });
    }
  }

  return findings;
}

function main(): void {
  const { values } = parseArgs({
    options: { json: { type: 'boolean', default: false } },
  });

  const files = walkScope(ROOT);
  const findings: Finding[] = [];
  for (const file of files) {
    try {
      const source = readFileSync(file, 'utf8');
      findings.push(...analyzeFile(file, source));
    } catch (err) {
      process.stderr.write(`check-nextjs-error: failed reading ${file}: ${(err as Error).message}\n`);
      process.exit(2);
    }
  }

  if (values.json) {
    process.stdout.write(`${JSON.stringify(findings, null, 2)}\n`);
    process.exit(0);
  }

  if (findings.length === 0) {
    process.exit(0);
  }

  for (const f of findings) {
    process.stderr.write(`${f.file}:${f.line}: ${f.code}: ${f.message}\n`);
  }
  process.stderr.write(`\ncheck-nextjs: ${findings.length} finding${findings.length === 1 ? '' : 's'}\n`);
  process.exit(1);
}

// Run as CLI when invoked directly.
const invokedDirectly = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('check-nextjs.ts');
if (invokedDirectly) main();

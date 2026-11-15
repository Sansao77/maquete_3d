#!/usr/bin/env node
'use strict';

/**
 * Prepara `desktop/app/` para empacotamento SEM tocar no site publicado.
 *
 * O `index.html` da raiz continua sendo a única fonte da verdade: ele é copiado
 * para `app/` e só então as URLs do CDN são reescritas para os arquivos locais
 * vendidos em `app/vendor/`. Se algum padrão esperado desaparecer do HTML (por
 * exemplo, alguém trocou a versão do three no CDN), o script falha com erro
 * explícito em vez de gerar um app que depende de internet.
 */

const fs = require('node:fs');
const path = require('node:path');

const DESKTOP_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..');
const APP_DIR = path.join(DESKTOP_DIR, 'app');
const VENDOR_DIR = path.join(APP_DIR, 'vendor');
const SOURCE_HTML = path.join(REPO_ROOT, 'index.html');
const THREE_DIR = path.join(DESKTOP_DIR, 'node_modules', 'three');

const THREE_VERSION = '0.128.0';

/** Mapeamento URL do CDN -> caminho relativo dentro de app/. */
const REWRITES = [
  {
    from: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.min.js`,
    to: 'vendor/three.min.js',
    source: path.join(THREE_DIR, 'build', 'three.min.js'),
  },
  {
    from: `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/js/controls/OrbitControls.js`,
    to: 'vendor/OrbitControls.js',
    source: path.join(THREE_DIR, 'examples', 'js', 'controls', 'OrbitControls.js'),
  },
];

/**
 * Aborta o build com uma mensagem acionável.
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`\n[prepare] ERRO: ${message}\n`);
  process.exit(1);
}

/** Valida que o three instalado é exatamente a versão usada pelo HTML. */
function assertThreeVersion() {
  const pkgPath = path.join(THREE_DIR, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    fail(
      `three não encontrado em ${THREE_DIR}.\n` +
        'Rode "npm install" dentro de desktop/ (ou "npm ci" no CI) antes de preparar o app.',
    );
  }

  const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (version !== THREE_VERSION) {
    fail(
      `versão do three instalada é ${version}, mas o index.html usa three@${THREE_VERSION}.\n` +
        'Ajuste a devDependency "three" para a mesma versão referenciada no HTML.',
    );
  }

  for (const { source, to } of REWRITES) {
    if (!fs.existsSync(source)) {
      fail(
        `arquivo vendor esperado não existe: ${source}\n` +
          `(necessário para ${to}). Verifique se o pacote three@${THREE_VERSION} foi instalado corretamente.`,
      );
    }
  }
}

/** Recria app/ do zero para não arrastar arquivos obsoletos de builds anteriores. */
function resetAppDir() {
  fs.rmSync(APP_DIR, { recursive: true, force: true });
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
}

/**
 * Copia o HTML da raiz reescrevendo apenas as URLs do CDN.
 * @returns {string} conteúdo final já com caminhos locais
 */
function buildHtml() {
  if (!fs.existsSync(SOURCE_HTML)) {
    fail(`index.html da raiz não encontrado em ${SOURCE_HTML}.`);
  }

  let html = fs.readFileSync(SOURCE_HTML, 'utf8');

  for (const { from, to } of REWRITES) {
    const occurrences = html.split(from).length - 1;
    if (occurrences !== 1) {
      fail(
        `esperava exatamente 1 ocorrência de "${from}" no index.html, encontrei ${occurrences}.\n` +
          'Se o CDN ou a versão do three mudou, atualize a lista REWRITES em desktop/scripts/prepare.js.',
      );
    }
    html = html.replace(from, to);
  }

  // Rede de segurança: qualquer CDN remanescente indica que o app não seria offline.
  if (html.includes('cdn.jsdelivr.net')) {
    fail('ainda há referências a cdn.jsdelivr.net no HTML gerado; o app não rodaria offline.');
  }

  return html;
}

/** Executa a preparação completa. */
function main() {
  assertThreeVersion();
  resetAppDir();

  fs.writeFileSync(path.join(APP_DIR, 'index.html'), buildHtml(), 'utf8');
  for (const { source, to } of REWRITES) {
    fs.copyFileSync(source, path.join(APP_DIR, to));
  }

  const vendorList = REWRITES.map(({ to }) => `  - ${to}`).join('\n');
  console.log(
    `[prepare] app pronto em ${path.relative(REPO_ROOT, APP_DIR)}/ (three@${THREE_VERSION} local)\n` +
      `${vendorList}`,
  );
}

main();

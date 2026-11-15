'use strict';

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

/** Diretório do app empacotado (gerado por scripts/prepare.js e incluído no asar). */
const APP_DIR = path.join(__dirname, 'app');
const APP_INDEX = path.join(APP_DIR, 'index.html');

/** Protocolos que autorizamos repassar ao navegador padrão do sistema. */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** @type {BrowserWindow | null} */
let mainWindow = null;

/**
 * Abre uma URL no navegador padrão. Qualquer coisa que não seja http(s)/mailto
 * é descartada silenciosamente para não expor handlers do SO ao conteúdo da página.
 * @param {string} rawUrl
 */
function openExternal(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (!EXTERNAL_PROTOCOLS.has(url.protocol)) return;
  // void evita unhandled rejection caso o SO não tenha handler para mailto.
  void shell.openExternal(url.toString());
}

/**
 * Aplica as políticas de navegação: a janela nunca sai do HTML local; links
 * externos vão para o navegador do sistema. Sem isso, um clique acidental
 * transformaria o app num browser sem barra de endereço.
 * @param {BrowserWindow} win
 */
function hardenNavigation(win) {
  const { webContents } = win;

  webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file://')) return;
    event.preventDefault();
    openExternal(url);
  });

  // Bloqueia drop de arquivos .html locais que substituiriam o app na janela.
  webContents.on('will-attach-webview', (event) => event.preventDefault());
}

/**
 * Registra F11 (alterna tela cheia) e Esc (sai da tela cheia) sem depender do menu.
 * @param {BrowserWindow} win
 */
function registerShortcuts(win) {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'F11') {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
      return;
    }
    if (input.key === 'Escape' && win.isFullScreen()) {
      event.preventDefault();
      win.setFullScreen(false);
    }
  });
}

/** Cria a janela principal carregando o HTML empacotado. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    useContentSize: true,
    show: false,
    backgroundColor: '#bcd9ef',
    autoHideMenuBar: true,
    title: 'Maquete 3D – Campus POLI-UPE Arruda',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  hardenNavigation(mainWindow);
  registerShortcuts(mainWindow);

  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadFile(APP_INDEX).catch((error) => {
    console.error('[maquete] falha ao carregar o HTML empacotado:', error);
  });
}

// Instância única: reabrir o executável foca a janela existente em vez de duplicar o render 3D.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

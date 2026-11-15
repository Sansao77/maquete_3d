# Maquete 3D – Campus POLI-UPE Arruda

Maquete 3D interativa do campus POLI-UPE (Arruda), em um único `index.html`
(HTML/CSS/JS puro + Three.js r128). O mesmo arquivo serve dois alvos:

| Alvo | Como é entregue |
| --- | --- |
| **Site** | Render, site estático, publica a raiz do repositório (`render.yaml`). |
| **Desktop** | Electron, empacotado offline em `.zip` e anexado a cada GitHub Release. |

`index.html` é a **única fonte da verdade**. O app desktop não tem cópia editada:
o build copia o arquivo e troca apenas as duas URLs de CDN por arquivos locais.

## Site (Render)

- `render.yaml` define `runtime: static` e `staticPublishPath: .`
- Nada em `desktop/` ou `.github/` é publicado além de ser inerte no site.
- Deploy continua automático a partir da `main`.

## App desktop

### Rodar localmente

```bash
cd desktop
npm install
npm start        # gera desktop/app/ e abre o Electron
```

Requisitos: Node.js LTS e npm. O primeiro `npm install` baixa o binário do
Electron (~100 MB).

### Gerar o `.zip` manualmente

```bash
cd desktop
npm ci
npm run build          # pacote da plataforma atual
npm run build:win      # apenas Windows (cross-build só funciona em Linux/macOS p/ win x64)
npm run build:mac      # apenas macOS (precisa rodar em macOS)
npm run build:linux    # apenas Linux
```

O resultado fica em `desktop/dist/`, com o nome

```
maquete-3d-poli-upe-v<versão>-<win|mac|linux>-<arch>.zip
```

### Como funciona o modo offline

`desktop/scripts/prepare.js` (executado por `npm run prep`):

1. apaga e recria `desktop/app/`;
2. copia `index.html` da raiz para `desktop/app/index.html`;
3. copia `node_modules/three/build/three.min.js` e
   `node_modules/three/examples/js/controls/OrbitControls.js` para
   `desktop/app/vendor/`;
4. reescreve **apenas na cópia** as URLs
   `https://cdn.jsdelivr.net/npm/three@0.128.0/...` por `vendor/...`;
5. falha com erro explícito se: a versão do `three` instalada não for `0.128.0`,
   algum arquivo vendor não existir, o padrão de CDN não aparecer exatamente uma
   vez, ou sobrar qualquer referência a `cdn.jsdelivr.net`.

O `index.html` da raiz nunca é modificado — por isso o Render segue intacto.

### `desktop/main.js`

- `BrowserWindow` 1280x800 (mín. 800x600), `autoHideMenuBar`, instância única;
- `F11` alterna tela cheia, `Esc` sai dela;
- navegação externa bloqueada: `http(s)`/`mailto` abrem no navegador padrão,
  qualquer outra navegação fora do HTML local é cancelada;
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.

## Versionamento e release

- **Conventional Commits** + **release-please** (`.github/workflows/release.yml`).
- Versão vive em `desktop/package.json`; o manifesto inicial é `1.0.0`.
- O release-please mantém uma PR `chore(main): release X.Y.Z` na `main`. Ao
  mergear essa PR, ele cria a tag `vX.Y.Z`, o `CHANGELOG.md` (em `desktop/`) e a
  GitHub Release.

| Prefixo do commit | Bump | Exemplo (a partir de 1.0.0) |
| --- | --- | --- |
| `fix:` / `perf:` | patch | 1.0.1 |
| `feat:` | minor | 1.1.0 |
| `feat!:` / `fix!:` ou rodapé `BREAKING CHANGE:` | major | 2.0.0 |
| `docs:`, `chore:`, `ci:`, `refactor:`, `test:` | nenhum | — |

### Por que o build roda no mesmo workflow

Tag e Release criadas pelo `GITHUB_TOKEN` **não disparam** outros workflows
(proteção anti-recursão do GitHub). Por isso `.github/workflows/release.yml`
tem dois jobs: `release-please` (exporta `release_created`, `tag_name`,
`version`) e `build` (`needs: release-please`, roda apenas quando
`release_created == 'true'`). Assim o zip é gerado e anexado sem depender de
PAT. Se um dia for necessário disparar workflows a partir da tag, aí sim crie um
PAT e passe em `token:`.

### Testar sem release

Actions → **release** → **Run workflow** (`workflow_dispatch`): roda só o build
e sobe os zips como artefatos do workflow. O campo `tag` é opcional e, se
preenchido com uma tag existente (`v1.2.3`), também anexa os zips àquela
Release.

### Build por plataforma

Matriz em `release.yml`: `windows-latest`, `ubuntu-latest` e `macos-latest`
(x64). Para desativar uma plataforma, comente a linha correspondente no
`matrix.include` — o job continua válido para as demais.

## Baixar e executar

1. Abra a página de **Releases** do repositório.
2. Baixe `maquete-3d-poli-upe-v<versão>-win-x64.zip` (Windows),
   `-mac-x64.zip` ou `-linux-x64.zip`.
3. Extraia o zip **inteiro** e execute o binário de dentro da pasta extraída
   (`Maquete 3D POLI-UPE.exe` / `.app` / `maquete-3d-poli-upe`).
4. Funciona sem internet: Three.js e OrbitControls vão dentro do pacote.

> **Windows SmartScreen**: os zips não são assinados digitalmente (não há
> certificado de code signing no projeto). Na primeira execução o Windows pode
> exibir "O Windows protegeu o computador". Clique em **Mais informações →
> Executar assim mesmo**. O mesmo vale para o aviso de "desenvolvedor não
> identificado" no macOS (aí use clique-direito → **Abrir**).

## Configuração manual (uma vez)

1. **Permissões do Actions**: *Settings → Actions → General → Workflow
   permissions* → **Read and write permissions** e marque **Allow GitHub Actions
   to create and approve pull requests**. Sem isso o release-please não abre a PR
   de release.
2. **Render — evitar redeploy inútil**: cada merge da PR de release altera
   `desktop/` (versão + changelog) e dispara um deploy estático idêntico. Em
   *Settings → Build & Deploy → Build Filters*, ou no `render.yaml`, ignore os
   caminhos que não afetam o site:

   ```yaml
   buildFilter:
     ignoredPaths:
       - desktop/**
       - .github/**
       - README.md
       - .gitignore
       - release-please-config.json
       - .release-please-manifest.json
   ```

   Não incluí isso no `render.yaml` de propósito: alterar o arquivo de serviço
   força um deploy e pode afetar o site em produção — aplique no dashboard ou
   num commit separado e consciente.
3. **Primeira release**: a PR do release-please só aparece após o primeiro
   commit `feat:`/`fix:` na `main` (os commits atuais não são convencionais).
   Para publicar já, use `workflow_dispatch` ou mergeie um `feat:` real.
4. **Ícone** (opcional): adicione `desktop/build/icon.png` 1024x1024 — veja
   `desktop/build/README.md`.

## Estrutura

```
index.html                     # fonte da verdade (site + desktop)
render.yaml                    # deploy estático no Render (não alterado)
desktop/
  package.json                 # deps do shell + versão do app
  main.js                      # processo principal do Electron
  electron-builder.yml         # alvo zip, nomes de artefato
  scripts/prepare.js           # cópia + vendorização offline
  build/README.md              # placeholder/documentação do ícone
  app/                         # GERADO (gitignored)
  dist/                        # GERADO (gitignored)
.github/workflows/release.yml  # release-please + build matriz + upload
release-please-config.json
.release-please-manifest.json
```

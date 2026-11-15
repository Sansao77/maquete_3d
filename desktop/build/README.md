# Ícone do app desktop

Este diretório é o `buildResources` do electron-builder. Ele está **vazio de
propósito**: o repositório não possui ícone próprio, então o app é empacotado
com o ícone padrão do Electron.

Para usar um ícone real, coloque um PNG quadrado de **1024x1024** em
`desktop/build/icon.png`. O electron-builder converte automaticamente para
`.ico` (Windows) e `.icns` (macOS) durante o build — nenhuma outra alteração de
configuração é necessária.

Checklist do ícone:

- PNG com canal alfa, 1024x1024, fundo transparente;
- evitar texto pequeno (o ícone é renderizado em 16x16 na barra de tarefas);
- sem marcas registradas de terceiros.

---
title: fix tailwind postcss configuration
type: note
permalink: development-logs/fix-tailwind-postcss-configuration
---

## Context
- Usuário reportou que a aplicação estava sem estilização ao seguir o checklist de testes.
- Identifiquei que o build do Vite não processava as diretivas `@tailwind` porque o projeto não tinha `postcss.config.js`.

## Alterações
- Criei `postcss.config.js` com Tailwind CSS e Autoprefixer registrados como plugins.
- Mantive as configurações existentes de Tailwind (`tailwind.config.js`) e os imports em `src/index.css`.

## QA
- `npm run lint` (apenas os warnings já existentes em `Profile.jsx` e `Ranking.jsx`).
- `npm run test` (falhou porque o script não existe no `package.json`).
- `npm run type-check` (falhou porque o script não existe no `package.json`).

## Resultado
- Tailwind volta a ser processado durante o build, restaurando o CSS utilitário em tempo de desenvolvimento e build.
- Alterações commitadas na branch `fix/css-styles-not-loading`. 
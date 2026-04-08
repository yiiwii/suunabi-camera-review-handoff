# Camera Review Handoff

Standalone handoff project for the Suunabi camera review interaction.

## Included

- iPhone mockup shell
- Camera review screen only
- Drag / resize / close interaction logic
- Hit-area debug toggle
- Static Vite build suitable for GitHub Pages

## Commands

```bash
npm install
npm run dev
npm run build
```

## GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml` for GitHub Pages deployment.

- Create the GitHub repository with Pages enabled
- Push to `main`
- The workflow will build and deploy `dist`
- `vite.config.ts` automatically uses the repository name as the Pages base path on GitHub Actions

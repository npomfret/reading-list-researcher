# Task 1: Project Setup

## Status: done

## Description
Update package.json, tsconfig.json, and create vitest.config.ts to match the project spec.

## Steps
1. Update `package.json`: set type: module, add bin entry, update scripts (dev, build, test, lint), add all dependencies (cosmiconfig, marked, pino, simple-plist, zod) and devDependencies (@types/node, tsup, tsx, typescript, vitest)
2. Update `tsconfig.json`: target ES2022, module ESNext, moduleResolution bundler, outDir dist, rootDir src, declaration true
3. Create `vitest.config.ts`
4. Run `npm install`

## Files
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`

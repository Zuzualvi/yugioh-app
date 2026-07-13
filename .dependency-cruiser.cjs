/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "contracts-no-internal-deps",
      severity: "error",
      comment:
        "contracts must not import from any other internal package (it is the innermost ring)",
      from: { path: "^packages/contracts/" },
      to: {
        path: "(packages/(engine|server|web)/|node_modules/@yugioh-app/(engine|server|web))",
      },
    },
    {
      name: "engine-no-server-or-web",
      severity: "error",
      comment: "engine may only depend on contracts — not server or web",
      from: { path: "^packages/engine/" },
      to: {
        path: "(packages/(server|web)/|node_modules/@yugioh-app/(server|web))",
      },
    },
    {
      name: "web-no-server-or-engine",
      severity: "error",
      comment: "web (frontend) must not import from server or engine — only contracts",
      from: { path: "^packages/web/" },
      to: {
        path: "(packages/(server|engine)/|node_modules/@yugioh-app/(server|engine))",
      },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "no circular dependencies anywhere in the codebase",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    /* Use the TypeScript compiler AST directly so that `import type` statements
       are visible to the cruiser (they are erased during transpilation). */
    parser: "tsc",
    /* Include type-only / pre-compilation imports in the analysis. */
    tsPreCompilationDeps: true,
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["module", "main", "types"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};

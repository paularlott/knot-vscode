// @ts-check
const esbuild = require('esbuild');

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: 'dist/extension.js',
    // `vscode` is provided by the host. `bufferutil` / `utf-8-validate` are
    // optional native deps of `ws` (absent at runtime; `ws` falls back to pure JS),
    // so keep them external. `ws` itself is bundled in.
    external: ['vscode', 'bufferutil', 'utf-8-validate'],
    sourcemap: true,
    logLevel: 'info',
};

(async () => {
    if (watch) {
        const ctx = await esbuild.context(options);
        await ctx.watch();
    } else {
        await esbuild.build(options);
    }
})().catch((err) => {
    console.error(err);
    process.exit(1);
});

import { build } from "esbuild";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const target = (process.argv[2] || "chrome") as "chrome" | "firefox";
const watch = process.argv.includes("--watch");
const isDev = process.env.__DEV__ === "true";

if (target !== "chrome" && target !== "firefox") {
  throw new Error("Target must be chrome or firefox");
}

const root = process.cwd();
const outDir = join(root, "dist", target);

if (!watch && existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}
mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, "popup"), { recursive: true });
mkdirSync(join(outDir, "assets"), { recursive: true });

const common = {
  bundle: true,
  sourcemap: true,
  minify: false,
  format: "esm" as const,
  target: ["chrome120", "firefox121"],
  define: {
    __DEV__: JSON.stringify(isDev),
  },
};

const run = async () => {
  if (watch) {
    const esbuild = await import("esbuild");
    const background = await esbuild.context({
      ...common,
      entryPoints: ["src/background.ts"],
      outfile: join(outDir, "background.js"),
    });
    const content = await esbuild.context({
      ...common,
      entryPoints: ["src/content.ts"],
      outfile: join(outDir, "content.js"),
    });
    const popup = await esbuild.context({
      ...common,
      entryPoints: ["src/popup/popup.ts"],
      outfile: join(outDir, "popup", "popup.js"),
    });
    await Promise.all([background.watch(), content.watch(), popup.watch()]);
  } else {
    await build({ ...common, entryPoints: ["src/background.ts"], outfile: join(outDir, "background.js") });
    await build({ ...common, entryPoints: ["src/content.ts"], outfile: join(outDir, "content.js") });
    await build({ ...common, entryPoints: ["src/popup/popup.ts"], outfile: join(outDir, "popup", "popup.js") });
  }

  copyFileSync(join(root, `manifest.${target}.json`), join(outDir, "manifest.json"));
  copyFileSync(join(root, "src", "popup", "popup.html"), join(outDir, "popup", "popup.html"));
  copyFileSync(join(root, "src", "popup", "popup.css"), join(outDir, "popup", "popup.css"));
  cpSync(join(root, "assets"), join(outDir, "assets"), { recursive: true });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

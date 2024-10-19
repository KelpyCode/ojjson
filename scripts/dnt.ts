// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./npm",
  shims: {
    // see JS docs for overview and more options
    deno: true,
  },
  package: {
    // package.json properties
    name: "ojjson",
    version: Deno.args[0],
    description: "ollama JSON response generator using zod",
    license: "MIT",
    repository: {
      type: "git",
      url: "git+https://github.com/KelpyCode/ojjson.git",
    },
    bugs: {
      url: "https://github.com/KelpyCode/ojjson/issues",
    },
  },
  postBuild() {
    // steps to run after building and before running the tests
    Deno.copyFileSync("LICENSE", "npm/LICENSE");
    Deno.copyFileSync("README.md", "npm/README.md");
  },
});

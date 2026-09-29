import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Browser-only modules keep their production imports; tests inject boundary doubles.
export function loadBrowserModule<T>(path: string, imports: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const source = readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source.replaceAll("import.meta.env", "__env"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    require: (name: string) => {
      if (!Object.hasOwn(imports, name)) throw new Error(`Missing test import: ${name}`);
      return imports[name];
    },
    __env: { BASE_URL: "/" },
    console: { warn: () => {}, error: () => {} },
    ...globals,
  }, { filename: path });
  return exports as T;
}

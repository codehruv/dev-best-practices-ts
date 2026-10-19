import { getNodeESLintConfig } from '../../eslint.config.base.ts';

export default getNodeESLintConfig({
  packageRootDir: import.meta.dirname,
  entryPointFiles: { '.': './src/index.ts' },
});

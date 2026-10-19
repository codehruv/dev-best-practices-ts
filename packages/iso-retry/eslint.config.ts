import { getIsomorphicESLintConfig } from '../../eslint.config.base.ts';

export default getIsomorphicESLintConfig({
  packageRootDir: import.meta.dirname,
  entryPointFiles: { '.': './src/index.ts' },
});

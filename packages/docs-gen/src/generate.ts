import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { format, resolveConfig } from 'prettier';

import { parseDocTest } from './parse-doc-test.ts';
import { parseFeature } from './parse-feature.ts';
import { renderFeaturePage } from './render-feature.ts';
import { type PageLink, renderIndex, renderPage, stampGenerated } from './render-markdown.ts';
import { FEATURE_DIR, FEATURE_TEST_DIR, featureTestFile, listFeatures } from './trace.ts';

/**
 * The quadrants generated from doc tests. Reference comes from TypeDoc and the feature
 * files, explanation is hand-written.
 */
const PAGE_QUADRANTS = ['tutorials', 'how-to'] as const;
const DOC_TEST_SUFFIX = '.test.ts';

/**
 * Writes the generated documentation of one package into `docs/`:
 *
 * - `docs/tutorials/` and `docs/how-to/` from the doc tests in `tests/docs/`. Both
 *   directories are wiped first, so a deleted doc test deletes its page.
 * - The generated header on every TypeDoc page in `docs/reference/`. Run TypeDoc first.
 * - `docs/reference/specifications/` from the Gherkin files in `features/`, wiped first
 *   like the doc test quadrants.
 * - `docs/README.md`, the index of all four quadrants. `docs/explanation/` is hand-written
 *   and only read, for page titles.
 *
 * Every written file goes through Prettier, so the output passes the repo format check
 * without a separate formatting step.
 *
 * @returns The written paths, relative to `packageDir`.
 */
export async function generateDocs(packageDir: string): Promise<string[]> {
  const root = resolve(packageDir);
  const docsDir = join(root, 'docs');
  const written: string[] = [];
  const write = async (path: string, markdown: string): Promise<void> => {
    const options = (await resolveConfig(path)) ?? {};
    writeFileSync(path, await format(markdown, { ...options, filepath: path }));
    written.push(relative(root, path));
  };

  const quadrantLinks: Record<(typeof PAGE_QUADRANTS)[number], PageLink[]> = {
    tutorials: [],
    'how-to': [],
  };
  for (const quadrant of PAGE_QUADRANTS) {
    const testDir = join(root, 'tests', 'docs', quadrant);
    const outDir = join(docsDir, quadrant);
    rmSync(outDir, { recursive: true, force: true });
    for (const testFile of listFiles(testDir, DOC_TEST_SUFFIX)) {
      mkdirSync(outDir, { recursive: true });
      const testPath = join(testDir, testFile);
      const sourcePath = relative(root, testPath);
      const page = parseDocTest(readFileSync(testPath, 'utf8'), sourcePath);
      const pageFile = `${pageSlug(testFile)}.md`;
      await write(
        join(outDir, pageFile),
        renderPage(page, { path: sourcePath, link: relative(outDir, testPath) }),
      );
      quadrantLinks[quadrant].push({ title: page.title, href: `${quadrant}/${pageFile}` });
    }
  }

  const referenceDir = join(docsDir, 'reference');
  for (const file of listFiles(referenceDir, '.md')) {
    const path = join(referenceDir, file);
    await write(path, stampGenerated(readFileSync(path, 'utf8'), 'src/ TSDoc comments by TypeDoc'));
  }

  const specificationDir = join(referenceDir, 'specifications');
  rmSync(specificationDir, { recursive: true, force: true });
  const specifications: PageLink[] = [];
  for (const featureFile of listFeatures(join(root, FEATURE_DIR))) {
    mkdirSync(specificationDir, { recursive: true });
    const featurePath = join(root, FEATURE_DIR, featureFile);
    const sourcePath = relative(root, featurePath);
    const page = parseFeature(readFileSync(featurePath, 'utf8'), sourcePath);
    const pageFile = `${featureFile.slice(0, -'.feature'.length)}.md`;
    await write(
      join(specificationDir, pageFile),
      renderFeaturePage(page, {
        path: sourcePath,
        link: relative(specificationDir, featurePath),
        testLink: relative(
          specificationDir,
          join(root, FEATURE_TEST_DIR, featureTestFile(featureFile)),
        ),
      }),
    );
    specifications.push({ title: page.title, href: `reference/specifications/${pageFile}` });
  }

  const explanationDir = join(docsDir, 'explanation');
  const explanation = listFiles(explanationDir, '.md').map((file) => ({
    title: firstHeading(readFileSync(join(explanationDir, file), 'utf8')) ?? file,
    href: `explanation/${file}`,
  }));

  const { name, description } = readManifest(root);
  mkdirSync(docsDir, { recursive: true });
  await write(
    join(docsDir, 'README.md'),
    renderIndex({
      packageName: name,
      description,
      tutorials: quadrantLinks.tutorials,
      howTo: quadrantLinks['how-to'],
      reference: [
        ...(existsSync(join(referenceDir, 'README.md'))
          ? [{ title: 'API reference', href: 'reference/README.md' }]
          : []),
        ...specifications,
      ],
      explanation,
    }),
  );
  return written;
}

/**
 * `01-getting-started.test.ts` becomes `getting-started`. The numeric prefix orders pages
 * by priority in the index but stays out of URLs, so reprioritizing never breaks links.
 */
function pageSlug(testFile: string): string {
  return testFile.slice(0, -DOC_TEST_SUFFIX.length).replace(/^\d+-/, '');
}

function listFiles(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => entry.name)
    .sort();
}

function firstHeading(markdown: string): string | undefined {
  const heading = markdown.split('\n').find((line) => line.startsWith('# '));
  return heading?.slice(2).trim();
}

function readManifest(root: string): { name: string; description: string } {
  const manifest: unknown = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (typeof manifest !== 'object' || manifest === null) {
    throw new Error(`${join(root, 'package.json')} is not a JSON object.`);
  }
  const name = 'name' in manifest && typeof manifest.name === 'string' ? manifest.name : undefined;
  if (name === undefined) {
    throw new Error(`${join(root, 'package.json')} has no "name".`);
  }
  const description =
    'description' in manifest && typeof manifest.description === 'string'
      ? manifest.description
      : '';
  return { name, description };
}

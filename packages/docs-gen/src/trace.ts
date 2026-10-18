import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { DocTestSyntaxError } from './errors.ts';
import { parseFeature } from './parse-feature.ts';
import type { FeaturePage, FeatureScenario } from './types.ts';

/** Where features and their step definitions live, relative to the package root. */
export const FEATURE_DIR = 'features';
export const FEATURE_TEST_DIR = 'tests/features';
const FEATURE_SUFFIX = '.feature';

/** A requirement tag: `@REQ-` and at least three digits, matching the spec template IDs. */
const REQUIREMENT_TAG = /^REQ-\d{3,}$/;
// Catches near misses such as `@req-1` or `@REQ_001`, which would silently trace nothing.
const REQUIREMENT_LIKE = /^req/i;
/**
 * Tags that make vitest-cucumber skip or focus a scenario. A skipped acceptance criterion
 * reads as verified on the page while nothing runs, so none of them may appear.
 */
const RUN_FILTER_TAGS: ReadonlySet<string> = new Set(['ignore', 'skip', 'only', 'wip']);

/** Which scenarios verify each requirement, and every traceability problem in a package. */
export interface TraceReport {
  /** Requirement ID to the scenarios that verify it, each as `features/<file>: <title>`. */
  readonly requirements: Readonly<Record<string, readonly string[]>>;
  /** Malformed or duplicate tags, untraced or skipped scenarios, and features no test runs. */
  readonly problems: readonly string[];
}

/**
 * Traces requirement IDs through every `.feature` file of a package. It fails a scenario
 * that names no requirement, a malformed or repeated tag, a skip tag, two scenarios with
 * one title (step definitions bind to scenarios by title), and a feature file with no step
 * definitions, which no test would ever run.
 */
export function traceRequirements(packageDir: string): TraceReport {
  const root = resolve(packageDir);
  const requirements: Record<string, string[]> = {};
  const problems: string[] = [];

  for (const file of listFeatures(join(root, FEATURE_DIR))) {
    const shown = `${FEATURE_DIR}/${file}`;
    const testFile = featureTestFile(file);
    const testPath = join(root, FEATURE_TEST_DIR, testFile);
    if (!existsSync(testPath)) {
      problems.push(`${shown}: no step definitions. Add ${FEATURE_TEST_DIR}/${testFile}.`);
    } else if (!readFileSync(testPath, 'utf8').includes(file)) {
      problems.push(`${FEATURE_TEST_DIR}/${testFile}: does not load ${shown}.`);
    }

    let page: FeaturePage;
    try {
      page = parseFeature(readFileSync(join(root, FEATURE_DIR, file), 'utf8'), shown);
    } catch (error: unknown) {
      if (error instanceof DocTestSyntaxError) {
        problems.push(error.message);
        continue;
      }
      throw error;
    }

    problems.push(...tagProblems(shown, 0, page.tags));
    const titles = new Set<string>();
    for (const scenario of page.scenarios) {
      const at = `${shown}:${scenario.line}`;
      if (titles.has(scenario.title)) {
        problems.push(`${at}: another scenario is already titled "${scenario.title}".`);
      }
      titles.add(scenario.title);
      problems.push(...tagProblems(shown, scenario.line, scenario.tags));

      const ids = requirementIds(page, scenario);
      if (ids.length === 0) {
        problems.push(`${at}: scenario "${scenario.title}" names no requirement. Tag it @REQ-NNN.`);
      }
      for (const id of ids) {
        (requirements[id] ??= []).push(`${shown}: ${scenario.title}`);
      }
    }
  }

  return { requirements, problems };
}

/** The requirement IDs a scenario verifies: its own tags plus the feature's, without `@`. */
export function requirementIds(page: FeaturePage, scenario: FeatureScenario): string[] {
  return [...new Set([...page.tags, ...scenario.tags])].filter((tag) => REQUIREMENT_TAG.test(tag));
}

/** `retry.feature` has its step definitions in `retry.feature.test.ts`. */
export function featureTestFile(featureFile: string): string {
  return `${featureFile}.test.ts`;
}

/** The `.feature` files directly under `dir`, sorted. */
export function listFeatures(dir: string): string[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(FEATURE_SUFFIX))
    .map((entry) => entry.name)
    .sort();
}

function tagProblems(shown: string, line: number, tags: readonly string[]): string[] {
  const at = line === 0 ? shown : `${shown}:${line}`;
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (seen.has(tag)) {
      problems.push(`${at}: tag @${tag} appears twice.`);
    }
    seen.add(tag);
    if (REQUIREMENT_LIKE.test(tag) && !REQUIREMENT_TAG.test(tag)) {
      problems.push(
        `${at}: tag @${tag} is not a requirement ID. Use @REQ- and three or more digits.`,
      );
    }
    if (RUN_FILTER_TAGS.has(tag.toLowerCase())) {
      problems.push(
        `${at}: tag @${tag} skips or focuses scenarios. Acceptance criteria always run.`,
      );
    }
  }
  return problems;
}

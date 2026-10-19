import { headingAnchors } from './markdown.ts';
import { generatedHeader, joinBlocks } from './render-markdown.ts';
import { requirementIds } from './trace.ts';
import type { FeaturePage, FeatureScenario, FeatureStep } from './types.ts';

/** Where a specification page's feature and step definitions live. */
interface FeatureSource {
  /** The feature path relative to the package root, shown in the generated header. */
  readonly path: string;
  /** The feature path relative to the page. */
  readonly link: string;
  /** The step definitions path relative to the page. */
  readonly testLink: string;
}

const REQUIREMENTS_HEADING = 'Requirements';
const BACKGROUND_HEADING = 'Background';

/**
 * Renders a parsed feature as a reference page: a requirements table first, so a spec or PR
 * can link a requirement ID straight to the scenarios that verify it, then one section per
 * scenario with its steps as a list.
 */
export function renderFeaturePage(page: FeaturePage, source: FeatureSource): string {
  const headings = [
    page.title,
    REQUIREMENTS_HEADING,
    ...(page.background.length > 0 ? [BACKGROUND_HEADING] : []),
    ...page.scenarios.map((scenario) => scenario.title),
  ];
  // The title, requirements, and background headings come first, so scenario anchors start
  // after them.
  const scenarioAnchors = headingAnchors(headings).slice(headings.length - page.scenarios.length);

  const blocks = [
    generatedHeader(source.path),
    `# ${page.title}`,
    page.description,
    `## ${REQUIREMENTS_HEADING}`,
    renderRequirementTable(page, scenarioAnchors),
  ];
  if (page.background.length > 0) {
    blocks.push(
      `## ${BACKGROUND_HEADING}`,
      'Every scenario starts with these steps.',
      renderSteps(page.background),
    );
  }
  page.scenarios.forEach((scenario) => {
    blocks.push(`## ${scenario.title}`, ...renderScenario(page, scenario));
  });
  blocks.push(
    `Every scenario on this page runs as a test in [\`${basename(source.testLink)}\`](${source.testLink}). ` +
      `The source is [\`${basename(source.path)}\`](${source.link}).`,
  );
  return joinBlocks(blocks);
}

function renderRequirementTable(page: FeaturePage, scenarioAnchors: readonly string[]): string {
  const byRequirement = new Map<string, string[]>();
  page.scenarios.forEach((scenario, index) => {
    for (const id of requirementIds(page, scenario)) {
      const links = byRequirement.get(id) ?? [];
      links.push(`[${scenario.title}](#${scenarioAnchors[index] ?? ''})`);
      byRequirement.set(id, links);
    }
  });
  if (byRequirement.size === 0) {
    return '_No scenario names a requirement._';
  }
  const rows = [...byRequirement]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
    .map(([id, links]) => `| <a id="${id.toLowerCase()}"></a>\`${id}\` | ${links.join(', ')} |`);
  return ['| Requirement | Verified by |', '| --- | --- |', ...rows].join('\n');
}

function renderScenario(page: FeaturePage, scenario: FeatureScenario): string[] {
  const ids = requirementIds(page, scenario);
  const blocks = [
    ids.length === 0
      ? ''
      : `Verifies ${ids.map((id) => `[\`${id}\`](#${id.toLowerCase()})`).join(', ')}.`,
    scenario.description,
    renderSteps(scenario.steps),
  ];
  for (const examples of scenario.examples) {
    blocks.push(
      examples.title === '' ? 'Examples:' : `Examples: ${examples.title}`,
      renderTable([examples.header, ...examples.rows]),
    );
  }
  return blocks;
}

function renderSteps(steps: readonly FeatureStep[]): string {
  return steps
    .map((step) => {
      const line = `- **${step.keyword}** ${step.text}`;
      const extras: string[] = [];
      if (step.docString !== undefined) {
        extras.push(['```', step.docString, '```'].join('\n'));
      }
      if (step.table.length > 0) {
        extras.push(renderTable(step.table));
      }
      // Indented two spaces, so the argument renders inside its list item.
      return [line, ...extras.map((extra) => indent(extra))].join('\n\n');
    })
    .join('\n');
}

function renderTable(rows: readonly (readonly string[])[]): string {
  const [header = [], ...body] = rows;
  const cells = (row: readonly string[]): string =>
    `| ${row.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`;
  return [cells(header), cells(header.map(() => '---')), ...body.map(cells)].join('\n');
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

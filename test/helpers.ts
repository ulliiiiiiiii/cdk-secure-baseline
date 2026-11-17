import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { App, Stack, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';

export function testStack(): Stack {
  const app = new App({
    outdir: mkdtempSync(join(tmpdir(), 'cdk-secure-baseline-')),
    context: { '@aws-cdk/core:validationReportJson': true },
  });
  return new Stack(app, 'Test', { env: { account: '123456789012', region: 'eu-central-1' } });
}

interface Violation {
  ruleName: string;
  severity: string;
  // validation-report.json names constructs; the legacy policy report names resources
  violatingConstructs?: { constructPath?: string }[];
  violatingResources?: { constructPath?: string }[];
}

/**
 * Every AwsSolutions error of the stack as "rule: construct path", empty when it passes.
 * cdk-nag 3 runs as a CDK validation plugin: synthesis fails and writes a JSON report.
 */
export function nagErrors(stack: Stack): string[] {
  const app = stack.node.root as App;
  Validations.of(app).addPlugins(new AwsSolutionsChecks(app));
  const log = console.log;
  const error = console.error;
  console.log = console.error = () => undefined; // the report is printed as well, read the JSON instead
  try {
    app.synth();
    return [];
  } catch (e) {
    const file = join(app.outdir, 'validation-report.json');
    if (!existsSync(file)) throw e;
    const report = JSON.parse(readFileSync(file, 'utf8')) as { pluginReports: { violations: Violation[] }[] };
    const found = report.pluginReports.flatMap((p) => p.violations)
      .filter((v) => v.severity === 'error')
      .flatMap((v) => [...(v.violatingConstructs ?? []), ...(v.violatingResources ?? [])]
        .map((c) => `${v.ruleName}: ${c.constructPath ?? '?'}`));
    return [...new Set(found)];
  } finally {
    console.log = log;
    console.error = error;
  }
}

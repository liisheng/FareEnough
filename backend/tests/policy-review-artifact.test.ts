import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { finalizePolicyReview } from '../scripts/finalize-policy-review.mjs';
import { REVIEW_STAGES } from '../scripts/policy-evaluation-checks.mjs';

const prefix = join(tmpdir(), 'fareenough-policy-review-');
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    // Delete only the individual temporary directories created by this test file.
    if (!resolve(directory).startsWith(resolve(prefix))) throw Error('Unexpected test directory');
    rmSync(directory, { recursive: true, force: true });
  }
});
const hash = (bytes: Buffer) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const directory = mkdtempSync(prefix);
  directories.push(directory);
  const reportPath = join(directory, 'sample-report.json');
  const reviewPath = join(directory, 'semantic-review.json');
  const report = {
    completedAt: '2026-10-16T00:00:00.000Z',
    cases: [{ caseId: 'CASE-A', completedAt: '2026-10-16T00:00:00.000Z', status: 'machine_checks_passed',
      checks: { allFiveStages: true, expectedOutcome: true, expectedAmount: true, backendDisposition: true, validProposal: true },
      finalDecisionChecksPassed: true, stageContractChecksPassed: true,
      stageChecks: Object.fromEntries(REVIEW_STAGES.map((stage: string) => [stage, { checks: { artifactPresent: true, schema: true, role: true, onlySuppliedEvidenceIds: true, onlySuppliedPolicyIds: true }, passed: true }])) }],
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  const review = { sourceReport: basename(reportPath), sourceReportSha256: hash(readFileSync(reportPath)),
    cases: { 'CASE-A': { stages: Object.fromEntries(REVIEW_STAGES.map((stage: string) => [stage, { status: 'passed', summary: 'Checked this stage against the supplied records, policy, opposing points and conclusion.', issues: [] }])) } } };
  const saveReview = () => writeFileSync(reviewPath, JSON.stringify(review, null, 2) + '\n');
  saveReview();
  const saveReportAndRebind = () => {
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
    review.sourceReportSha256 = hash(readFileSync(reportPath));
    saveReview();
  };
  return { directory, reportPath, reviewPath, report, review, saveReview, saveReportAndRebind };
}

describe('immutable reviewed policy acceptance artifact', () => {
  it('passes a complete five-stage audit and preserves raw report and review bytes', () => {
    const f = fixture();
    const rawBefore = readFileSync(f.reportPath);
    const reviewBefore = readFileSync(f.reviewPath);
    const result = finalizePolicyReview(f);
    expect(result.status).toBe('passed');
    expect(result.path).toBe(join(f.directory, 'sample-report-acceptance.json'));
    expect(result.artifact).toMatchObject({ sourceReport: 'sample-report.json', sourceReportSha256: hash(rawBefore), sourceReviewSha256: hash(reviewBefore), status: 'passed' });
    expect(result.artifact.cases[0]).toMatchObject({ caseId: 'CASE-A', status: 'passed', semanticReviewPassed: true });
    expect(readFileSync(f.reportPath)).toEqual(rawBefore);
    expect(readFileSync(f.reviewPath)).toEqual(reviewBefore);
    expect(JSON.parse(readFileSync(result.path, 'utf8'))).toEqual(result.artifact);
  });

  it('rejects any raw-byte change after the semantic review was bound', () => {
    const f = fixture();
    writeFileSync(f.reportPath, readFileSync(f.reportPath, 'utf8') + '\n');
    expect(() => finalizePolicyReview(f)).toThrow('SOURCE_REPORT_HASH_MISMATCH');
  });

  it('rejects a matching hash attributed to a different report basename', () => {
    const f = fixture();
    f.review.sourceReport = 'other-report.json';
    f.saveReview();
    expect(() => finalizePolicyReview(f)).toThrow('SOURCE_REPORT_NAME_MISMATCH');
  });

  it('never passes a case missing its semantic audit', () => {
    const f = fixture();
    delete (f.review.cases as Partial<typeof f.review.cases>)['CASE-A'];
    f.saveReview();
    const result = finalizePolicyReview(f);
    expect(result.status).toBe('pending');
    expect(result.artifact.cases[0].pendingSemanticStages).toEqual(REVIEW_STAGES);
  });

  it('cannot review away a machine failure', () => {
    const f = fixture();
    f.report.cases[0].checks.validProposal = false;
    f.saveReportAndRebind();
    const result = finalizePolicyReview(f);
    expect(result.status).toBe('failed');
    expect(result.artifact.cases[0]).toMatchObject({ finalDecisionChecksPassed: false, semanticReviewPassed: true });
  });

  it('refuses reports that have not completed', () => {
    const f = fixture();
    f.report.cases[0].status = 'running';
    f.saveReportAndRebind();
    expect(() => finalizePolicyReview(f)).toThrow('SOURCE_REPORT_NOT_COMPLETE');
  });

  it('never overwrites a previous acceptance or either input file', () => {
    const f = fixture();
    const result = finalizePolicyReview(f);
    const acceptedBytes = readFileSync(result.path);
    expect(() => finalizePolicyReview(f)).toThrow('OUTPUT_ALREADY_EXISTS');
    expect(readFileSync(result.path)).toEqual(acceptedBytes);
    const rawBefore = readFileSync(f.reportPath);
    expect(() => finalizePolicyReview({ ...f, outputPath: f.reportPath })).toThrow('OUTPUT_ALREADY_EXISTS');
    expect(readFileSync(f.reportPath)).toEqual(rawBefore);
    expect(() => finalizePolicyReview({ ...f, outputPath: f.reviewPath })).toThrow('OUTPUT_ALREADY_EXISTS');
  });

  it('exposes a CLI with a JSON-only status and output path', () => {
    const f = fixture();
    const script = fileURLToPath(new URL('../scripts/finalize-policy-review.mjs', import.meta.url));
    const run = spawnSync(process.execPath, [script, '--report', f.reportPath, '--review', f.reviewPath], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stderr).toBe('');
    expect(JSON.parse(run.stdout)).toEqual({ status: 'passed', path: join(f.directory, 'sample-report-acceptance.json') });
  });
});

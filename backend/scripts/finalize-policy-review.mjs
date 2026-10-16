// Evaluation-only finalization. Never calls a provider or modifies the source report.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateOverallAcceptance } from './policy-evaluation-checks.mjs';

const sha256 = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const completeTimestamp = value => typeof value === 'string' && value.trim() !== '' && Number.isFinite(Date.parse(value));
const finalCheckNames = ['allFiveStages', 'expectedOutcome', 'expectedAmount', 'backendDisposition', 'validProposal'];

function parseObject(bytes, code) {
  let value;
  try { value = JSON.parse(bytes.toString('utf8')); } catch { fail(code); }
  if (!object(value)) fail(code);
  return value;
}

/** Accept only a completed raw report and an audit bound to its exact bytes. */
export function finalizePolicyReview({ reportPath, reviewPath, outputPath }) {
  if (typeof reportPath !== 'string' || typeof reviewPath !== 'string') fail('REPORT_AND_REVIEW_REQUIRED');
  const sourcePath = resolve(reportPath);
  const auditPath = resolve(reviewPath);
  const reportBytes = readFileSync(sourcePath);
  const reviewBytes = readFileSync(auditPath);
  const report = parseObject(reportBytes, 'INVALID_SOURCE_REPORT');
  const review = parseObject(reviewBytes, 'INVALID_SEMANTIC_REVIEW');
  const reportHash = sha256(reportBytes);
  if (review.sourceReport !== basename(sourcePath)) fail('SOURCE_REPORT_NAME_MISMATCH');
  if (review.sourceReportSha256 !== reportHash) fail('SOURCE_REPORT_HASH_MISMATCH');
  if (!completeTimestamp(report.completedAt) || !Array.isArray(report.cases) || report.cases.length === 0 ||
    report.cases.some(item => !object(item) || typeof item.caseId !== 'string' || !item.caseId.trim() ||
      !completeTimestamp(item.completedAt) || item.status === 'running') ||
    new Set(report.cases.map(item => item.caseId)).size !== report.cases.length) fail('SOURCE_REPORT_NOT_COMPLETE');
  if (review.cases !== undefined && !object(review.cases)) fail('INVALID_SEMANTIC_REVIEW');

  const cases = report.cases.map(item => {
    // Missing machine checks cannot be replaced by an auditor's approval.
    const checks = { ...(object(item.checks) ? item.checks : {}) };
    for (const name of finalCheckNames) checks[name] = item.checks?.[name] === true;
    checks.recordedRunNotFailed = !['failed', 'machine_checks_failed', 'expectations_failed'].includes(item.status);
    checks.recordedFinalDecisionNotFailed = item.finalDecisionChecksPassed !== false;
    checks.recordedStageContractsNotFailed = item.stageContractChecksPassed !== false;
    const auditedStages = review.cases?.[item.caseId]?.stages;
    return { caseId: item.caseId,
      ...evaluateOverallAcceptance(checks, item.stageChecks, object(auditedStages) ? auditedStages : {}) };
  });
  const status = cases.some(item => item.status === 'failed') ? 'failed'
    : cases.every(item => item.status === 'passed') ? 'passed' : 'pending';
  const artifact = {
    scope: 'Reviewed evaluation acceptance only. No model calls or financial actions; raw reports remain unchanged.',
    sourceReport: basename(sourcePath), sourceReportSha256: reportHash,
    sourceReview: basename(auditPath), sourceReviewSha256: sha256(reviewBytes),
    createdAt: new Date().toISOString(), status, cases,
  };
  const destination = resolve(outputPath ?? sourcePath.slice(0, sourcePath.length - extname(sourcePath).length) + '-acceptance.json');
  // Exclusive creation also refuses raw/review paths, existing artifacts and symlinks.
  try { writeFileSync(destination, JSON.stringify(artifact, null, 2) + '\n', { flag: 'wx' }); }
  catch (error) { if (error?.code === 'EEXIST') fail('OUTPUT_ALREADY_EXISTS'); throw error; }
  return { status, path: destination, artifact };
}

function parseArgs(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    if (!['--report', '--review', '--output'].includes(flag) || !value || value.startsWith('--') || values[flag] !== undefined) fail('INVALID_ARGUMENTS');
    values[flag] = value;
  }
  if (!values['--report'] || !values['--review']) fail('REPORT_AND_REVIEW_REQUIRED');
  return { reportPath: values['--report'], reviewPath: values['--review'], outputPath: values['--output'] };
}

const comparablePath = value => process.platform === 'win32' ? value.toLowerCase() : value;
if (process.argv[1] && comparablePath(resolve(process.argv[1])) === comparablePath(fileURLToPath(import.meta.url))) {
  try {
    const result = finalizePolicyReview(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify({ status: result.status, path: result.path }));
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ status: 'error', errorCode: typeof error?.code === 'string' ? error.code : 'FINALIZATION_FAILED' }));
    process.exitCode = 2;
  }
}

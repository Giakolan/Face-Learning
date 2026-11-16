import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Pilot entries observed in the upstream PR history. Confirm them with the
// maintainer before reusing the policy for an enforced check.
const scopes = {
  liupiyan: {
    base: 'feature/b-pca',
    files: ['matlab/fitPCA.m', 'matlab/transformPCA.m', 'tests/testPCA.m'],
  },
  bugtail: {
    base: 'feature/c-lda',
    files: [
      'matlab/fitLDA.m', 'matlab/transformLDA.m',
      'matlab/tests/test_LDA_math.m', 'matlab/tests/test_LDA_synthetic.m',
    ],
  },
  giakolan: {
    base: 'feature/d-bayes',
    files: ['matlab/fitBayes.m', 'matlab/predictBayes.m'],
  },
  uhumipaa: {
    base: 'feature/e-mlp',
    files: ['matlab/MLPtest.m', 'matlab/fitMLP.m', 'matlab/predictMLP.m'],
  },
  'cloud-sky-0128': {
    base: 'feature/f-cv-runner',
    files: [
      'matlab/createFoldManifest.m', 'matlab/loadFoldData.m',
      'matlab/prepareFHandoff.m', 'matlab/runFStageOne.m',
      'matlab/sha256File.m', 'matlab/validateFoldManifest.m',
      'matlab/validateTrainDataset.m', 'tests/testFoldManifest.m',
    ],
  },
};

function getRule(login) {
  const key = login?.toLowerCase();
  return Object.hasOwn(scopes, key) ? scopes[key] : undefined;
}

export function audit(pr, git) {
  if (pr.state !== 'OPEN') throw new Error('The pull request is not open.');
  if (pr.author?.login?.toLowerCase() === 'heetah') return { skipped: true };
  const rule = getRule(pr.author?.login);
  if (!rule) {
    throw new Error('No role is configured for this PR author.');
  }
  if (pr.baseRefName !== rule.base) {
    throw new Error(`The PR must target ${rule.base}.`);
  }
  if (pr.isDraft) throw new Error('Draft PRs are not ready for integration.');
  if (!/^[a-f0-9]{40}$/.test(pr.headRefOid)) throw new Error('Invalid PR head SHA.');

  const main = git('rev-parse', '--verify', 'refs/remotes/origin/main').trim();
  const role = git('rev-parse', '--verify', `refs/remotes/origin/${rule.base}`).trim();
  const head = git('rev-parse', '--verify', `refs/face-audit/pr/${pr.number}`).trim();
  if (head !== pr.headRefOid) throw new Error('The PR head changed during the audit. Rerun it.');
  if (git('merge-base', main, head).trim() !== main) {
    throw new Error('Update the PR branch to include the current upstream main.');
  }
  if (git('merge-base', main, role).trim() !== main) {
    throw new Error('The target role branch must be synchronized with upstream main.');
  }

  // Treat renames as delete/add, so both the old and the new path are checked.
  const paths = git('diff', '--no-renames', '--name-only', '-z', `${role}...${head}`, '--')
    .split('\0')
    .filter(Boolean);
  if (paths.length === 0) throw new Error('The PR has no role changes to audit.');
  const unexpected = paths.filter((path) => !rule.files.includes(path));
  if (unexpected.length) {
    throw new Error(`Paths outside the role allowlist: ${JSON.stringify(unexpected)}`);
  }
  return { main, role, head, paths };
}

function run(pullNumber) {
  if (!/^[1-9][0-9]*$/.test(pullNumber ?? '')) {
    throw new Error('Supply a positive PR number.');
  }
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 ** 2 });
  const repo = process.env.GITHUB_REPOSITORY || 'heetah/Face-Learning';
  const pr = JSON.parse(execFileSync('gh', [
    'pr', 'view', pullNumber, '--repo', repo,
    '--json', 'number,author,baseRefName,headRefOid,isDraft,state',
  ], { encoding: 'utf8' }));
  if (String(pr.number) !== pullNumber) throw new Error('Unexpected PR number returned by GitHub.');
  const rule = getRule(pr.author?.login);
  if (rule && pr.baseRefName === rule.base && !pr.isDraft && pr.state === 'OPEN') {
    // Fetch Git objects only. No PR checkout, hooks, build, or script execution.
    git('fetch', '--no-tags', 'origin',
      '+refs/heads/main:refs/remotes/origin/main',
      `+refs/heads/${rule.base}:refs/remotes/origin/${rule.base}`,
      `+refs/pull/${pullNumber}/head:refs/face-audit/pr/${pullNumber}`);
  }
  console.log(JSON.stringify(audit(pr, git), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run(process.argv[2]);
  } catch (error) {
    console.error(`Role audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}

const core = require('@actions/core');
const github = require('@actions/github');
const checkVersions = require('./check-versions');

(async () => {
  try {
    const { issue, payload } = github.context;

    const client = new github.GitHub(
      core.getInput('github-token', { required: true })
    );

    const optionalPackages = (core.getInput('optional-packages') || '')
      .split(/\r?\n/)
      .map((p) => p.trim());

    const requiredPackages = (core.getInput('required-packages') || '')
      .split(/\r?\n/)
      .map((p) => p.trim());

    const { found, missing, outdated } = await checkVersions(
      payload.issue.body,
      optionalPackages,
      requiredPackages
    );

    const messages = [];

    if (Object.keys(missing).length) {
      messages.push(
        `Couldn't find version numbers for the following packages in the issue:
${Object.keys(missing)
  .map((p) => `- \`${p}\``)
  .join('\n')}

Can you update the issue to include version numbers for those packages? The version numbers must match the format 1.2.3.`
      );
    }

    if (Object.keys(outdated).length) {
      messages.push(
        `The versions mentioned in the issue for the following packages differ from the latest versions on npm:
${Object.keys(outdated)
  .map((p) => `- \`${p}\` (found: \`${found[p]}\`, latest: \`${outdated[p]}\`)`)
  .join('\n')}

Can you verify that the issue still exists after upgrading to the latest versions of these packages?`
      );
    }

    if (messages.length) {
      const comment = core.getInput('comment');

      if (comment !== false) {
        await client.issues.createComment({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.number,
          body: messages.join('\n\n'),
        });
      }

      const missingVersionsLabel = core.getInput('missing-versions-label');

      if (missingVersionsLabel) {
        await client.issues.addLabels({
          owner: issue.owner,
          repo: issue.repo,
          issue_number: issue.number,
          labels: [missingVersionsLabel],
        });
      }
    }

    core.setOutput(
      'found',
      Object.entries(found)
        .map(([p, v]) => `${p}@${v}`)
        .join(',')
    );

    core.setOutput(
      'outdated',
      Object.entries(outdated)
        .map(([p, v]) => `${p}@${v}`)
        .join(',')
    );

    core.setOutput('missing', Object.keys(missing).join(','));
  } catch (e) {
    console.log(e);
    core.setFailed(e.message);
  }
})();

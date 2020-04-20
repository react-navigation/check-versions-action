const fetch = require('node-fetch');

const REGISTRY = 'https://registry.npmjs.org';

/**
 * Check package versions in the markdown content
 *
 * @param {string} body
 * @param {string[]} packages
 */
async function checkVersions(body, packages) {
  const lines = body.split('\n');

  const found = {};
  const missing = {};
  const outdated = {};

  for (const line of lines) {
    for (const p of packages) {
      if (line.includes(p)) {
        const parts = line
          // Get the version number from the version table or from package.json lines
          .replace(/[\|\s":,]+/g, ' ')
          // Get the version number from lines like package@version
          .replace(/\b@\b/g, ' ')
          .trim()
          .split(' ');

        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === p) {
            // Strip semver symbols and v prefix
            const version = parts[i + 1]
              .replace(/^v/, '')
              .replace(/[\^\~]/, '');

            // Check if version matches the proper format
            if (version && /^\d+\.\d+\.\d+/.test(version)) {
              found[p] = version;

              if (missing[p]) {
                delete missing[p];
              }

              break;
            } else if (!found[p]) {
              missing[p] = true;
            }
          }
        }
      }
    }
  }

  // For all found packages, resolve the latest version from npm
  for (const p in found) {
    const url = `${REGISTRY}/${p}`;

    const response = await fetch(url, {
      headers: {
        Accept:
          'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
      },
      timeout: 5000,
    });

    if (response.status !== 200) {
      throw new Error(response.statusText);
    }

    const meta = await response.json();

    if (meta.versions) {
      const latest = meta['dist-tags'] ? meta['dist-tags'].latest : null;

      if (latest !== found[p]) {
        outdated[p] = latest;
      }
    }
  }

  return { found, missing, outdated };
}

module.exports = checkVersions;

const githubDiff = require('node-github-diff');
const fs = require('fs');
const upath = require('upath');
const chalk = require('chalk');
const fetch = require('node-fetch');

const checkDiffPatches = require('./check-diff-patches');
const { formatProps, printMessage } = require('./util');

const getPackageJsonData = async (generator, token) => {
  const urlComplement = token ? `?token=${token}` : '';
  const response = await fetch(`https://raw.githubusercontent.com/${generator}/master/package.json${urlComplement}`, { method: 'GET' });
  const res = await response.json();

  return res;
};

const transformContentToJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));

const run = async (generator, templatePrefix, ejsOpen, ejsClose, githubToken) => {

  let oldGeneratorVersion;
  let newGeneratorVersion;
  let props;

  const githubRepository = generator.split('/').pop();

  try {

    const writeYoRCFileContent = (yoRcJson, githubRepository, yoRcJsonPath) => {
      const githubRepositoryInfo = yoRcJson[githubRepository];
      const newPackageJson = Object.assign(
        {},
        yoRcJson,
        { [githubRepository]: Object.assign({}, githubRepositoryInfo, { version: newGeneratorVersion }) }
      );

      fs.writeFileSync(yoRcJsonPath, JSON.stringify(newPackageJson, null, 2), 'utf8');
    };

    const updateGeneratorVersion = (version) => {

      const projectPackageJsonPath = upath.join(process.cwd(), 'package.json');
      const yoRcJsonPath = upath.join(process.cwd(), '.yo-rc.json');

      const projectPackageJson = transformContentToJson(projectPackageJsonPath, 'utf8');
      const yoRcJson = transformContentToJson(yoRcJsonPath, 'utf8');

      oldGeneratorVersion = yoRcJson[githubRepository].version;

      if (oldGeneratorVersion === version) {
        throw new Error(`Generator ${generator} is up-to-date.`);
      }

      printMessage(chalk.inverse(' INFO ') +
        ` Updating generator ${generator} from: v${oldGeneratorVersion} to v${version}\n`);

      props = formatProps(projectPackageJson, yoRcJson);

      writeYoRCFileContent(yoRcJson, githubRepository, yoRcJsonPath);
    };

    const { version } = await getPackageJsonData(generator, githubToken);
    newGeneratorVersion = version;

    //  Update the version field in your `.yo-rc.json`.
    //  If .yo-rc.json hasn't changed between generator versions this must be done manually
    await updateGeneratorVersion(version);

    const patches = await githubDiff({
      repository: generator,
      base: `v${oldGeneratorVersion}`,
      head: `v${newGeneratorVersion}`,
      token: githubToken,
    });

    await checkDiffPatches(
      generator,
      `v${oldGeneratorVersion}`,
      `v${newGeneratorVersion}`,
      props,
      templatePrefix,
      patches,
      ejsOpen,
      ejsClose
    );

    printMessage(`\n${chalk.green(' ✔ ')}` +
      ` Yeoman generator ${githubRepository} updated to v${newGeneratorVersion}`);

  } catch (error) {
    printMessage(`\n${chalk.red(' ✘ ')}` +
      ` An error occurred when tried to updated ${githubRepository} yeoman generator ` +
      `from 'v${oldGeneratorVersion}' to 'v${newGeneratorVersion}'\n`, error);
    throw error;

  }
};

module.exports = run;

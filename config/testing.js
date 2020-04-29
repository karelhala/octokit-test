const util = require('util');
const { resolve, join } = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const exec = util.promisify(require('child_process').exec);

const readDir = (folder) => util.promisify(fs.readdir)(folder);
const readFile = (fileName) => util.promisify(fs.readFile)(fileName, 'utf8');
const writeFile = (fileName, data) => util.promisify(fs.writeFile)(fileName, data, 'utf8');
const readJson = (fileName) => readFile(fileName).then(JSON.parse);
const writeJson = (fileName, data) => writeFile(fileName, JSON.stringify(data, null, 4) + '\n');

const bot = require('./comment-bot');
const { uploadFiles, octokit: pushBot } = require('./push-bot');

dotenv.config();
const [ owner, repo ] = process.env.TRAVIS_REPO_SLUG.split('/');
const monorepoFolder = 'packages';


const calculatePackages = async () => {
    return readDir(join(__dirname, `../${monorepoFolder}/`));
};

(async () => {
    const files = (await calculatePackages()).map((packageFolder) => `${monorepoFolder}/${packageFolder}/package.json`);
    uploadFiles({ owner, repo }, files, 'some msg');
})()

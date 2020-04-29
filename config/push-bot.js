const dotenv = require('dotenv');
const { Octokit } = require('@octokit/rest');
const util = require('util');
const fs = require('fs');
const { resolve } = require('path');

const readFile = (fileName) => util.promisify(fs.readFile)(fileName, 'utf8');

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GH_TOKEN_PUSH,
    userAgent: 'nacho-bot',
    previews: [ 'jean-grey', 'symmetra' ],
    timeZone: 'Europe/Prague',
    baseUrl: 'https://api.github.com'
});

const encodeFile = async (filename) => Buffer.from(await readFile(filename)).toString('base64');

const pushFile = async ({ owner, repo }, fileName, message) => {
    let sha;
    try {
        const { data: contents } = await octokit.repos.getContents({
            owner,
            repo,
            path: fileName
        });
        sha = contents && contents.sha;
    } catch (e) {
        console.log(`File ${fileName} not found! Will creatre new file.`);
    }

    const filePath = resolve(__dirname, `../${fileName}`);
    const content = await encodeFile(filePath);

    console.log(`File path of ${fileName} is: ${filePath}`);
    console.log(`Content of ${fileName} is: ${content}`);

    octokit.repos.createOrUpdateFile({
        owner,
        repo,
        path: fileName,
        message: message || 'Release of new version!',
        content: content,
        ...sha && { sha }
    });
};

const generateSha = async ({ owner, repo }, fileName) => {
    const filePath = resolve(__dirname, `../${fileName}`);
    const content = await encodeFile(filePath);
    try {
        const { data: contents } = await octokit.git.createBlob({
            owner,
            repo,
            content,
            encoding: 'base64'
        });
        return {
            sha: contents.sha,
            path: fileName
        };
    } catch (e) {
        console.log('Error while generating blob sha');
    }
}

const getRef = async ({ owner, repo }) => {
    try {
        const { data: contents } = await octokit.git.getRef({
            owner,
            repo,
            ref: 'heads/master'
        });
        return contents;
    } catch (e) {
        console.log(e);
    }
}

const createTree = async ({ owner, repo }, files, base_tree) => {
    try {
        const { data: contents } = await octokit.git.createTree({
            owner,
            repo,
            tree: files.map(({ sha, path }) => ({
                path,
                sha,
                type: 'blob',
                mode: '100644'
            })),
            base_tree
          });
        return contents;
    } catch (e) {
        console.log(e);
    }
};

const createCommit = async ({ owner, repo }, message, tree, parents) => {
    try {
        const { data: contents } = await octokit.git.createCommit({
            owner,
            repo,
            message,
            tree,
            parents,
          });
        return contents;
    } catch (e) {
        console.log(e);
    }
}

const updateRef = async ({ owner, repo }, sha) => {
    try {
        const { data: contents } = await octokit.git.updateRef({
            owner,
            repo,
            ref: 'heads/master',
            sha,
          });
        return contents;
    } catch (e) {
        console.log(e);
    }
}

const uploadFiles = async ({ owner, repo }, fileNames, message) => {
    const fileShas = await Promise.all(fileNames.map(async (fileName) => (
        generateSha({ owner, repo }, fileName)
    )));
    const ref = await getRef({ owner, repo });
    const tree = await createTree({ owner, repo }, fileShas, ref.object.sha);
    const commit = await createCommit({ owner, repo }, message, tree.sha, [ref.object.sha]);
    updateRef({ owner, repo }, commit.sha);
}

module.exports = {
    pushFile,
    uploadFiles,
    octokit
};

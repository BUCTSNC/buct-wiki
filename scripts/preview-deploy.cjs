const { readdirSync, lstatSync, cpSync } = require('node:fs');
const { join } = require('node:path');

function previewPrefix(repository) {
	switch (repository) {
		case 'BUCTSNC/buct-wiki': return 'pr-';
		case 'BUCTSNC/buct-wiki-content': return 'content-pr-';
		default: throw new Error(`Unsupported preview repository: ${repository}`);
	}
}

async function findPullRequest(github, context) {
	const run = context.payload.workflow_run;
	if (run.event !== 'pull_request' || !run.conclusion ||
		!run.head_repository?.full_name || !run.head_branch ||
		run.path !== '.github/workflows/pr-preview-build.yml') return null;
	const pulls = await github.paginate(github.rest.repos.listPullRequestsAssociatedWithCommit, {
		...context.repo, commit_sha: run.head_sha,
	});
	const matches = pulls.filter(pr =>
		pr.state === 'open' && pr.base.repo.full_name === `${context.repo.owner}/${context.repo.repo}` &&
		pr.base.ref === 'main' && pr.head.sha === run.head_sha &&
		pr.head.repo?.full_name === run.head_repository.full_name && pr.head.ref === run.head_branch);
	return matches.length === 1 ? matches[0] : null;
}

function runUrl(context, id = context.runId) {
	return `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${id}`;
}

async function startPreview(github, context, core, pr) {
	const { data: deployment } = await github.rest.repos.createDeployment({
		...context.repo, ref: pr.head.sha, auto_merge: false, required_contexts: [],
		environment: `Preview PR #${pr.number}`, transient_environment: true, production_environment: false,
	});
	// Preserve the ID for the always() finalizer even if the pending status request fails.
	core.setOutput('id', deployment.id);
	await github.rest.repos.createDeploymentStatus({
		...context.repo, deployment_id: deployment.id, state: 'pending', log_url: runUrl(context),
	});
}

async function finishPreview(github, context, { deploymentId, number, sha, url, alias }) {
	const buildSucceeded = context.payload.workflow_run.conclusion === 'success';
	const state = buildSucceeded && url ? 'success' : 'failure';
	const previewUrl = alias || url;
	const logUrl = runUrl(context, buildSucceeded ? context.runId : context.payload.workflow_run.id);
	await github.rest.repos.createDeploymentStatus({
		...context.repo, deployment_id: deploymentId, state,
		...(state === 'success' ? { environment_url: previewUrl } : {}),
		log_url: logUrl,
	});
	// Finish tracking the deployment even if the PR changed, but never replace its current comment.
	const { data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number: number });
	if (pr.state !== 'open' || pr.head.sha !== sha) return;
	const marker = '<!-- cloudflare-pr-preview -->';
	const result = state === 'success'
		? `[打开最近成功预览](${previewUrl}) / [查看此次部署](${url})`
		: `本次预览${buildSucceeded ? '发布失败' : '构建未成功'}。[查看运行日志](${logUrl})`;
	const body = [
		marker, '### Cloudflare Workers 预览', '', result, '', `提交：\`${sha}\``, '',
		'每个 PR 的预览相互独立；后续提交会更新此评论。',
		'预览不会提交反馈或连接正式数据库。',
	].join('\n');
	const comments = await github.paginate(github.rest.issues.listComments, {
		...context.repo, issue_number: number,
	});
	const previous = comments.find(c => c.user?.login === 'github-actions[bot]' && c.body?.startsWith(marker));
	if (previous) {
		await github.rest.issues.updateComment({ ...context.repo, comment_id: previous.id, body });
	} else {
		await github.rest.issues.createComment({ ...context.repo, issue_number: number, body });
	}
}

function preparePreviewAssets(source, destination) {
	// Validate the entire artifact before copying any file into the upload directory.
	function validate(directory) {
		for (const entry of readdirSync(directory)) {
			const path = join(directory, entry);
			const stat = lstatSync(path);
			if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
				throw new Error(`Unsupported preview asset: ${path}`);
			}
			if (stat.isDirectory()) validate(path);
		}
	}
	validate(source);
	if (!lstatSync(join(source, 'index.html')).isFile()) throw new Error('Missing preview index.html');
	cpSync(source, destination, { recursive: true });
}

function previewUrls(output) {
	const result = JSON.parse(output);
	function workersUrl(urls) {
		const url = urls?.find(value => {
			try {
				const url = new URL(value);
				return url.protocol === 'https:' && url.hostname.endsWith('.workers.dev');
			} catch { return false; }
		});
		if (!url) throw new Error('Wrangler did not return a workers.dev preview URL');
		return url;
	}
	return { url: workersUrl(result.deployment?.urls), alias: workersUrl(result.preview?.urls) };
}

module.exports = { previewPrefix, findPullRequest, startPreview, finishPreview, preparePreviewAssets, previewUrls };

if (require.main === module) {
	const [source, destination] = process.argv.slice(2);
	if (!source || !destination) throw new Error('Usage: preview-deploy.cjs source destination');
	preparePreviewAssets(source, destination);
}

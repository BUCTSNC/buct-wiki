import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../worker/index.ts';

function environment() {
	const sqlite = new DatabaseSync(':memory:');
	for (const file of ['page_views.sql', 'feedback.sql']) {
		sqlite.exec(readFileSync(new URL(`../d1/${file}`, import.meta.url), 'utf8'));
	}
	return { sqlite, env: {
		DB: { prepare(sql) { return { bind(...args) { return {
			async run() { const r = sqlite.prepare(sql).run(...args); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
			async first() { return sqlite.prepare(sql).get(...args); },
		}; } }; } },
		ASSETS: { async fetch() { return new Response('static fallback', { status: 404 }); } },
	} };
}
const request = (path, body, method = 'POST') => new Request(`https://wiki.example${path}`, {
	method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});

test('Worker routes both existing APIs to the migrated D1 handlers', async () => {
	const { env, sqlite } = environment();
	try {
		for (const views of [1, 2]) {
			const response = await worker.fetch(request('/api/page-views', { path: '/article' }), env);
			assert.equal(response.status, 200);
			assert.deepEqual(await response.json(), { path: '/article/', views });
		}
		const response = await worker.fetch(request('/api/feedback/', {
			path: '/article', type: 'suggestion', content: 'A useful suggestion for this article.',
		}), env);
		assert.equal(response.status, 201);
		assert.equal((await response.json()).success, true);
		assert.equal(sqlite.prepare('SELECT status FROM feedback').get().status, 'pending');
	} finally { sqlite.close(); }
});

test('unknown APIs and wrong methods never reach D1 or static fallback', async () => {
	const env = { get DB() { throw new Error('Unexpected D1 call'); },
		ASSETS: { fetch() { throw new Error('Unexpected asset fallback'); } } };
	assert.equal((await worker.fetch(request('/api/unknown', {}), env)).status, 404);
	const response = await worker.fetch(request('/api/feedback', null, 'GET'), env);
	assert.equal(response.status, 405);
	assert.equal(response.headers.get('Allow'), 'POST');
});

test('invalid inputs do not write rows and missing static files use the asset handler', async () => {
	const { env, sqlite } = environment();
	try {
		assert.equal((await worker.fetch(request('/api/feedback', { path: '/x', type: 'other', content: 'short' }), env)).status, 400);
		assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM feedback').get().n, 0);
		assert.equal(await (await worker.fetch(request('/missing', null, 'GET'), env)).text(), 'static fallback');
	} finally { sqlite.close(); }
});

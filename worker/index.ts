import { post as feedback } from './api/feedback.ts';
import { post as pageViews } from './api/page-views.ts';
import type { Env } from './env.ts';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const path = new URL(request.url).pathname.replace(/\/$/, '');
		const handler = path === '/api/feedback' ? feedback
			: path === '/api/page-views' ? pageViews : undefined;
		if (handler) {
			if (request.method !== 'POST') {
				return Response.json({ error: 'Method not allowed' }, {
					status: 405, headers: { Allow: 'POST' },
				});
			}
			return handler(request, env);
		}
		if (path === '/api' || path.startsWith('/api/')) {
			return Response.json({ error: 'Not found' }, { status: 404 });
		}
		return env.ASSETS.fetch(request);
	},
};

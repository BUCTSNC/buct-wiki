import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const contentPrefix = 'src/content/docs/content/';

export const onRequest = defineRouteMiddleware(({ locals }) => {
	const { entry } = locals.starlightRoute;
	// Keep explicit frontmatter URLs and disabled edit links unchanged.
	if (entry.data.editUrl !== true || !entry.filePath?.startsWith(contentPrefix)) return;

	const filePath = entry.filePath.slice(contentPrefix.length);
	locals.starlightRoute.editUrl = new URL(
		filePath.split('/').map(encodeURIComponent).join('/'),
		'https://github.com/BUCTSNC/buct-wiki-content/edit/main/',
	);
});

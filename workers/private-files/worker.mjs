const ID = /^[A-Za-z0-9_-]{1,128}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = env.APP_ORIGIN;
    const headers = new Headers({
      'Cache-Control': 'private, no-store',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    const reply = (status, message) => new Response(message, {status, headers});
    if (!allowed || origin !== allowed) return reply(403, 'Origin denied');
    headers.set('Access-Control-Allow-Origin', allowed);
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Authorization');
      return reply(204, null);
    }
    if (request.method !== 'GET') return reply(405, 'Read-only development API');
    if (env.STORAGE_ENABLED !== 'true') return reply(503, 'Storage disabled');
    if (!env.FILES || !env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return reply(503, 'Configuration missing');
    const path = new URL(request.url).pathname.split('/');
    if (path.length !== 6 || path[1] !== 'v1' || path[2] !== 'projects' || path[4] !== 'files' || !ID.test(path[3]) || !UUID.test(path[5])) return reply(404, 'Not found');
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer [^\s]+$/.test(authorization)) return reply(401, 'Authentication required');
    try {
      const base = new URL(env.SUPABASE_URL);
      if (base.protocol !== 'https:' || base.username || base.password) return reply(503, 'Invalid configuration');
      const authHeaders = {apikey: env.SUPABASE_ANON_KEY, Authorization: authorization};
      const userResponse = await fetch(new URL('/auth/v1/user', base), {headers: authHeaders, redirect: 'error', signal: AbortSignal.timeout(8000)});
      if (!userResponse.ok) return reply(userResponse.status >= 500 ? 503 : 401, 'Authentication unavailable or invalid');
      const user = await userResponse.json();
      if (!UUID.test(user.id || '')) return reply(401, 'Authentication required');
      const projectURL = new URL('/rest/v1/rk_projects', base);
      projectURL.search = new URLSearchParams({select: 'id', user_id: 'eq.' + user.id, id: 'eq.' + path[3], deleted: 'eq.false', limit: '1'});
      const projectResponse = await fetch(projectURL, {headers: authHeaders, redirect: 'error', signal: AbortSignal.timeout(8000)});
      if (!projectResponse.ok) return reply(503, 'Project authorization unavailable');
      const projects = await projectResponse.json();
      if (!Array.isArray(projects) || projects.length !== 1 || projects[0].id !== path[3]) return reply(404, 'Not found');
      const object = await env.FILES.get('v1/' + user.id + '/' + path[3] + '/' + path[5]);
      if (!object || !object.body) return reply(404, 'Not found');
      headers.set('Content-Type', 'application/octet-stream');
      headers.set('Content-Disposition', 'attachment');
      headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
      return new Response(object.body, {headers});
    } catch {
      return reply(503, 'Storage unavailable');
    }
  }
};

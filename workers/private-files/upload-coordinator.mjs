import {DurableObject} from 'cloudflare:workers';
import {createUploadService} from './upload-service.mjs';

// Not exported by the production Worker; no deployment configuration is added.
// Future caller must use one fixed Durable Object ID for the whole quota domain.
export class PrivateUploadCoordinator extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.service = env.UPLOADS_ENABLED === 'true' ? createUploadService(ctx.storage, env.FILES, {
      globalBytes: Number(env.GLOBAL_BYTES),
      userBytes: Number(env.USER_BYTES),
      fileBytes: Number(env.FILE_BYTES)
    }) : null;
  }
  async upload(record, body) {
    if (!this.service) throw new Error('Uploads disabled');
    // Only a trusted Worker binding may call this after Auth/project checks.
    return this.service.upload(record, body);
  }
  fetch() { return new Response('No public upload endpoint', {status: 404}); }
}

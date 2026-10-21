import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireRoles } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';
import { getInstitutionSettings, updateInstitutionSettings } from './settings.service.js';

const updateSettingsSchema = z.object({
  faculty_name: z.string().min(2).max(150).optional(),
  university_name: z.string().min(2).max(150).optional(),
  decan_name: z.string().min(2).max(150).optional(),
  decan_nip: z.string().max(50).optional(),
  decan_title: z.string().min(2).max(150).optional(),
  cert_city: z.string().min(2).max(100).optional(),
  cert_validity_years: z.number().int().min(1).max(10).optional(),
  cert_no_prefix: z.string().min(2).max(50).optional(),
});

export const settingsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('preHandler', authenticate);

  // GET /settings/institution
  fastify.get('/settings/institution', async (_request, reply) => {
    const settings = await getInstitutionSettings();
    return reply.send({ settings });
  });

  // PATCH /settings/institution (Admin only)
  fastify.patch('/settings/institution', {
    preHandler: [requireRoles(['admin'])],
    handler: async (request, reply) => {
      const parse = updateSettingsSchema.safeParse(request.body);
      if (!parse.success) {
        throw new AppError('VALIDATION_FAILED', 'Data pengaturan tidak valid', parse.error.format());
      }

      const updated = await updateInstitutionSettings(
        parse.data,
        request.user!.id,
        request.ip
      );

      return reply.send({ success: true, settings: updated });
    },
  });
};

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { pool } from '../../db/connection.js';
import { authenticate, requireRoles } from '../../lib/authz.js';

export const auditRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/audit-logs', {
    preHandler: [authenticate, requireRoles(['admin'])],
    handler: async (request, reply) => {
      const query = request.query as {
        actor_id?: string;
        action?: string;
        entity_type?: string;
        from?: string;
        to?: string;
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(Math.max(parseInt(query.limit || '50', 10), 1), 100);
      const offset = Math.max(parseInt(query.offset || '0', 10), 0);

      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (query.actor_id) {
        conditions.push(`a.actor_id = $${paramIndex++}`);
        params.push(query.actor_id);
      }

      if (query.action) {
        conditions.push(`a.action = $${paramIndex++}`);
        params.push(query.action);
      }

      if (query.entity_type) {
        conditions.push(`a.entity_type = $${paramIndex++}`);
        params.push(query.entity_type);
      }

      if (query.from) {
        const fromDate = new Date(query.from);
        if (!isNaN(fromDate.getTime())) {
          conditions.push(`a.created_at >= $${paramIndex++}`);
          params.push(fromDate.toISOString());
        }
      }

      if (query.to) {
        const toDate = new Date(query.to);
        if (!isNaN(toDate.getTime())) {
          conditions.push(`a.created_at <= $${paramIndex++}`);
          params.push(toDate.toISOString());
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countRes = await pool.query(
        `SELECT COUNT(*) AS total FROM audit_logs a ${whereClause};`,
        params
      );
      const total = parseInt(countRes.rows[0].total, 10);

      // Data query
      const dataQuery = `
        SELECT 
          a.id, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id,
          a.reason, a.before_data, a.after_data, a.ip_address, a.created_at,
          u.email AS actor_email
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;

      params.push(limit, offset);
      const { rows } = await pool.query(dataQuery, params);

      return reply.send({
        data: rows,
        meta: {
          total,
          limit,
          offset,
        },
      });
    },
  });
};

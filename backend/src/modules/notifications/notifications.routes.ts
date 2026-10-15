import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { pool } from '../../db/connection.js';
import { authenticate } from '../../lib/authz.js';
import { AppError } from '../../lib/errors.js';

export const notificationRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // GET /notifications (A, M)
  fastify.get('/notifications', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const user = request.user!;
      const query = request.query as {
        unread_only?: string;
        limit?: string;
        offset?: string;
      };

      const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 100);
      const offset = Math.max(parseInt(query.offset || '0', 10), 0);
      const unreadOnly = query.unread_only === 'true';

      const conditions: string[] = ['recipient_id = $1'];
      const params: any[] = [user.id];
      let paramIndex = 2;

      if (unreadOnly) {
        conditions.push('read_at IS NULL');
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const countRes = await pool.query(
        `SELECT COUNT(*) AS total FROM notifications ${whereClause};`,
        params
      );
      const total = parseInt(countRes.rows[0].total, 10);

      const unreadCountRes = await pool.query(
        `SELECT COUNT(*) AS unread FROM notifications WHERE recipient_id = $1 AND read_at IS NULL;`,
        [user.id]
      );
      const unreadTotal = parseInt(unreadCountRes.rows[0].unread, 10);

      const dataQuery = `
        SELECT id, type, title, body, entity_type, entity_id, created_at, read_at
        FROM notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++};
      `;
      params.push(limit, offset);

      const { rows } = await pool.query(dataQuery, params);

      return reply.send({
        data: rows,
        meta: {
          total,
          unread_total: unreadTotal,
          limit,
          offset,
        },
      });
    },
  });

  // PATCH /notifications/:id/read (A, M)
  fastify.patch('/notifications/:id/read', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const { rows } = await pool.query(
        `UPDATE notifications
         SET read_at = now()
         WHERE id = $1 AND recipient_id = $2 AND read_at IS NULL
         RETURNING id, read_at;`,
        [id, user.id]
      );

      if (rows.length === 0) {
        // Cek apakah memang ada tetapi sudah dibaca, atau memang bukan miliknya (INV-14: 404)
        const check = await pool.query(
          `SELECT id, read_at FROM notifications WHERE id = $1 AND recipient_id = $2;`,
          [id, user.id]
        );
        if (check.rows.length === 0) {
          throw new AppError('NOT_FOUND');
        }
        return reply.send({ success: true, notification: check.rows[0] });
      }

      return reply.send({ success: true, notification: rows[0] });
    },
  });

  // POST /notifications/read-all (A, M)
  fastify.post('/notifications/read-all', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const user = request.user!;

      const result = await pool.query(
        `UPDATE notifications
         SET read_at = now()
         WHERE recipient_id = $1 AND read_at IS NULL;`,
        [user.id]
      );

      return reply.send({
        success: true,
        updated_count: result.rowCount || 0,
      });
    },
  });

  // Aliases for /me/notifications
  fastify.get('/me/notifications', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      return (fastify as any).inject({
        method: 'GET',
        url: '/api/v1/notifications',
        headers: request.headers,
      }).then((res: any) => reply.status(res.statusCode).send(res.json()));
    },
  });

  fastify.patch('/me/notifications/:id/read', {
    preHandler: [authenticate],
    handler: async (request, reply) => {
      const { id } = request.params as { id: string };
      return (fastify as any).inject({
        method: 'PATCH',
        url: `/api/v1/notifications/${id}/read`,
        headers: request.headers,
      }).then((res: any) => reply.status(res.statusCode).send(res.json()));
    },
  });
};

import { Client, TablesDB } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');

  const tablesDB = new TablesDB(client);
  const databaseId = process.env.JUCHESS_DATABASE_ID ?? 'juchess';

  log(`JuChess admin action ${req.method} ${req.path || '/'}`);

  if (req.method === 'GET') {
    return res.json({
      ok: true,
      service: 'juchess-admin-actions',
      databaseId,
      ready: Boolean(tablesDB),
    });
  }

  error('Admin mutations are not implemented yet.');
  return res.json({
    ok: false,
    error: 'Admin mutation routes will be added after the Appwrite schema is created.',
  });
};

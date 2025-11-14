// zyncrate/functions/cron-clean.ts
import { queryDB, execDB } from "../lib/db";
import { deleteFromR2 } from "../lib/r2";

export async function onRequest(context: any) {
  const now = Date.now();

  // get expired + not-deleted files
  const { results } = await queryDB(
    context.env,
    `SELECT key, path FROM files 
     WHERE expires_at < ? AND is_deleted = 0`,
    [now]
  );

  for (const row of results) {
    try {
      await deleteFromR2(context.env, row.path);
      await execDB(
        context.env,
        `UPDATE files SET is_deleted = 1 WHERE key = ?`,
        [row.key]
      );
    } catch (err) {
      console.warn("cleanup error:", err);
    }
  }

  return new Response("OK");
}

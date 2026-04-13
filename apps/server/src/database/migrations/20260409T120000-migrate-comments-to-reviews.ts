import { type Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Kysely migrations already run inside a transaction; use db directly as trx.
  const trx = db;
  {
    // 1. Load parent page-comments to migrate
    const parentComments = await trx
      .selectFrom('comments')
      .selectAll()
      .where('type', '=', 'page')
      .where('parent_comment_id', 'is', null)
      .where('deleted_at', 'is', null)
      .where('selection', 'is', null)
      .orderBy('created_at', 'asc')
      .execute();

    const commentToReview = new Map<string, string>();
    const workspaceSeq = new Map<string, number>();
    const reviewRows: any[] = [];

    for (const c of parentComments) {
      const reviewId = crypto.randomUUID();
      commentToReview.set(c.id, reviewId);

      const next = (workspaceSeq.get(c.workspace_id) ?? 0) + 1;
      workspaceSeq.set(c.workspace_id, next);

      reviewRows.push({
        id: reviewId,
        sequence_id: next,
        title: null,
        status: c.resolved_at ? 'resolved' : 'open',
        content: c.content,
        creator_id: c.creator_id,
        page_id: c.page_id,
        space_id: c.space_id,
        workspace_id: c.workspace_id,
        resolved_at: c.resolved_at,
        resolved_by_id: c.resolved_by_id ?? null,
        created_at: c.created_at,
        updated_at: c.updated_at ?? c.created_at,
        deleted_at: null,
      });
    }

    if (reviewRows.length > 0) {
      // Batch insert in chunks of 500 to avoid parameter limits
      const chunkSize = 500;
      for (let i = 0; i < reviewRows.length; i += chunkSize) {
        await trx
          .insertInto('reviews')
          .values(reviewRows.slice(i, i + chunkSize))
          .execute();
      }
    }

    // 2. First review_history entry = parent comment content
    const historyRows: any[] = parentComments.map((c) => ({
      id: crypto.randomUUID(),
      review_id: commentToReview.get(c.id)!,
      type: 'comment',
      content: c.content,
      old_status: null,
      new_status: null,
      creator_id: c.creator_id,
      workspace_id: c.workspace_id,
      created_at: c.created_at,
      updated_at: c.updated_at ?? c.created_at,
      edited_at: c.edited_at ?? null,
      deleted_at: null,
    }));

    // 3. Child comments → review_histories
    let childCount = 0;
    if (commentToReview.size > 0) {
      const parentIds = Array.from(commentToReview.keys());
      const children = await trx
        .selectFrom('comments')
        .selectAll()
        .where('type', '=', 'page')
        .where('parent_comment_id', 'in', parentIds)
        .where('deleted_at', 'is', null)
        .where('selection', 'is', null)
        .orderBy('created_at', 'asc')
        .execute();

      for (const c of children) {
        const reviewId = commentToReview.get(c.parent_comment_id!);
        if (!reviewId) continue;
        childCount += 1;
        historyRows.push({
          id: crypto.randomUUID(),
          review_id: reviewId,
          type: 'comment',
          content: c.content,
          old_status: null,
          new_status: null,
          creator_id: c.creator_id,
          workspace_id: c.workspace_id,
          created_at: c.created_at,
          updated_at: c.updated_at ?? c.created_at,
          edited_at: c.edited_at ?? null,
          deleted_at: null,
        });
      }
    }

    if (historyRows.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < historyRows.length; i += chunkSize) {
        await trx
          .insertInto('review_histories')
          .values(historyRows.slice(i, i + chunkSize))
          .execute();
      }
    }

    // 4. Update notifications.review_id for migrated comment notifications
    let notificationUpdates = 0;
    for (const [commentId, reviewId] of commentToReview) {
      const res = await trx
        .updateTable('notifications')
        .set({ review_id: reviewId })
        .where('comment_id', '=', commentId)
        .executeTakeFirst();
      notificationUpdates += Number(res.numUpdatedRows ?? 0);
    }

    // 5. Seed sequences table (review + review_anchor) per workspace
    const workspaceIds = new Set<string>(workspaceSeq.keys());
    // Include any workspace that has comments even if counter is 0, so
    // review_anchor sequence row exists too. Use the set of workspaces from reviews.
    for (const wsId of workspaceIds) {
      const currentValue = workspaceSeq.get(wsId) ?? 0;
      await trx
        .insertInto('sequences')
        .values({
          workspace_id: wsId,
          sequence_name: 'review',
          current_value: currentValue,
        })
        .onConflict((oc) =>
          oc.columns(['workspace_id', 'sequence_name']).doUpdateSet({
            current_value: sql`GREATEST(sequences.current_value, ${currentValue})`,
          }),
        )
        .execute();

      await trx
        .insertInto('sequences')
        .values({
          workspace_id: wsId,
          sequence_name: 'review_anchor',
          current_value: 0,
        })
        .onConflict((oc) => oc.columns(['workspace_id', 'sequence_name']).doNothing())
        .execute();
    }

    // eslint-disable-next-line no-console
    console.log(
      `[migrate-comments-to-reviews] reviews=${reviewRows.length} histories=${historyRows.length} childComments=${childCount} notificationsLinked=${notificationUpdates} workspaces=${workspaceIds.size}`,
    );
  }
}

// WARNING: This down function is destructive and best-effort. It assumes no
// new reviews or review_histories have been created since `up` ran.
export async function down(db: Kysely<any>): Promise<void> {
  // eslint-disable-next-line no-console
  console.warn(
    '[migrate-comments-to-reviews] down() is destructive: deletes ALL reviews/review_histories and clears notifications.review_id. Only safe if no post-migration review data exists.',
  );

  const trx = db;
  await trx
    .updateTable('notifications')
    .set({ review_id: null })
    .where('review_id', 'is not', null)
    .execute();

  await trx.deleteFrom('review_histories').execute();
  await trx.deleteFrom('reviews').execute();
  await trx
    .deleteFrom('sequences')
    .where('sequence_name', 'in', ['review', 'review_anchor'])
    .execute();
}

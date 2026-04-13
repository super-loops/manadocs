import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import { sql } from 'kysely';

@Injectable()
export class SequenceRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async nextVal(
    workspaceId: string,
    sequenceName: string,
    trx?: KyselyTransaction,
  ): Promise<number> {
    const db = dbOrTx(this.db, trx);

    // Upsert: insert if not exists, then increment atomically
    const result = await db
      .insertInto('sequences')
      .values({
        workspaceId,
        sequenceName,
        currentValue: 1,
      })
      .onConflict((oc) =>
        oc.columns(['workspaceId', 'sequenceName']).doUpdateSet({
          currentValue: sql`sequences.current_value + 1`,
        }),
      )
      .returning('currentValue')
      .executeTakeFirstOrThrow();

    return Number(result.currentValue);
  }
}

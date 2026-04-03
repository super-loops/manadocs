import { DB } from '@manadocs/db/types/db';
import { PageEmbeddings } from '@manadocs/db/types/embeddings.types';

export interface DbInterface extends DB {
  pageEmbeddings: PageEmbeddings;
}

import type { Pool } from "pg";

export type Queryable = Pick<Pool, "query">;
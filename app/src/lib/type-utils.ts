// Type utilities for converting Prisma types to API types
import type { Decimal } from '@prisma/client/runtime/library';

/**
 * Recursively converts a camelCase string to snake_case at the type level.
 * e.g. "virtualSolReserves" → "virtual_sol_reserves"
 */
export type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${CamelToSnakeCase<U>}`
    : `${Lowercase<T>}_${CamelToSnakeCase<U>}`
  : S;

/**
 * Converts all keys of an object type from camelCase to snake_case.
 */
export type CamelToSnake<T> = {
  [K in keyof T as CamelToSnakeCase<K & string>]: T[K];
};

/**
 * Convert a single Prisma field type to its API equivalent:
 * - Decimal → number
 * - Date → string
 * - null → undefined (so nullable fields become optional-friendly)
 */
type ToApiField<T> =
  T extends Decimal ? number :
  T extends Date ? string :
  T extends null ? undefined :
  T;

/**
 * Distribute over unions: e.g. `Decimal | null` → `number | undefined`
 */
type ApiField<T> = T extends unknown ? ToApiField<T> : never;

/**
 * Extract keys whose value type includes `undefined` (i.e. nullable Prisma fields).
 */
type OptionalKeys<T> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

/**
 * Extract keys whose value type does NOT include `undefined`.
 */
type RequiredKeys<T> = Exclude<keyof T, OptionalKeys<T>>;

/**
 * Full Prisma-to-API conversion:
 * 1. snake_case keys
 * 2. Decimal→number, Date→string, null→undefined
 * 3. Fields that had `| null` in Prisma become optional (`?`)
 */
export type PrismaToApi<T> = {
  // First, apply snake_case + field conversion
  [K in keyof CamelToSnake<T>]: ApiField<CamelToSnake<T>[K]>;
} extends infer Converted
  ? // Then split into required + optional
    { [K in RequiredKeys<Converted>]: Exclude<Converted[K], undefined> } &
    { [K in OptionalKeys<Converted>]?: Exclude<Converted[K], undefined> }
  : never;

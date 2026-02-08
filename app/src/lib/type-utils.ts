// Type utilities for converting between camelCase and snake_case

/**
 * Recursively converts a camelCase string to snake_case
 */
export type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${CamelToSnakeCase<U>}`
    : `${Lowercase<T>}_${CamelToSnakeCase<U>}`
  : S;

/**
 * Converts all keys in an object from camelCase to snake_case
 */
export type CamelToSnake<T> = {
  [K in keyof T as CamelToSnakeCase<K & string>]: T[K];
};

/**
 * Utility type to replace specific fields while preserving others
 */
export type ReplaceFields<T, R> = Omit<T, keyof R> & R;

/**
 * Converts Prisma types to API-friendly types:
 * - Decimal -> number
 * - Date -> string  
 * - string | null -> string | undefined
 */
export type PrismaToApi<T> = {
  [K in keyof T]: T[K] extends Date 
    ? string 
    : T[K] extends { toNumber(): number }
      ? number
      : T[K] extends string | null
        ? string | undefined
        : T[K];
};
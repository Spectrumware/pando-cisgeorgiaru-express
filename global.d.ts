import * as _ from './app';

declare global {  

  type JSONValue = string | number | boolean | JSONObject | JSONArray | undefined | null | bigint;

  type JSONArray = JSONValue[];

  type JSONObject = { [key: string]: JSONValue };

  type DBRetirevalValueObject = { [key: string]: string | number | boolean | bigint | null | string[] | number[] | boolean[] | bigint[] | {low: number | bigint, high: number | bigint} };

  type MyRequest<T extends Express.Request> = T & { csrfToken: () => string };

  type NonUnd<T> = T extends undefined ? never : T;

  type NonNull<T> = T extends null ? never : T;

  type RemoveUndefined<T, B extends boolean = true> = B extends true ? NonUnd<T> : T;

  type RemoveUndefinedIfTrue<T, B extends boolean = true> = B extends true ? NonUnd<T> : T;

  type RemoveUndefinedIfOverrideIsNotUndefined<T, B> = B extends undefined ? T : NonUnd<T>;

  type RemoveNull<T, B extends boolean = true> = B extends true ? NonNull<T> : T;

  type RemoveNullIfOverrideIsNotNull<T, B> = B extends null ? T : NonNull<T>;

  type RemoveNullable<SourceObject, OverrideObject> = {
    [SourceKey in keyof SourceObject]: SourceKey extends keyof OverrideObject ? NonNullable<SourceObject[SourceKey]> & OverrideObject[SourceKey] : SourceObject[SourceKey];
  };

  type MarkOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

  type Replace<T, K> = Omit<T, keyof K> & K;

  interface ObjectConstructor {
    omit<T extends {}, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K>;
  }

  type FixedSizeArray<N extends number, T> = N extends 0 ? never[] : {
      0: T;
      length: N;
  } & ReadonlyArray<T>;

  type IDRequired<T extends {id?: any}> = Omit<T, 'id'> & {id: NonNullable<T['id']>};
}

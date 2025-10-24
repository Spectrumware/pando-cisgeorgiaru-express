type AssociateModels = { [key: string]: any}

type ModelObject = import('./index').ModelObject;

// filters map over the object replacing each field with an array of the field type
type DBModelToFilter<T extends {}> = {
  [key in keyof T]: Array<T[key]>
}

type additionalFunction = (models: import('./index').ModelObject, ...args: any[]) => Promise<any>

type DBType = 'string' | 'number' | 'json' | 'bigint';

type ImmediateFilters = {
  '=': string | number | bigint,
  '!=': string | number | bigint,
  '>': number | bigint,
  '>=': number | bigint,
  '<': number | bigint,
  '<=': number | bigint,
  'BETWEEN': {low: number | bigint, high: number | bigint},
  'LIKE': string,
  'ILIKE': string,
  'IN': (string[] | number[]),
  'IS': null
  'NOT BETWEEN': {low: number | bigint, high: number | bigint},
  'NOT LIKE': string,
  'NOT ILIKE': string,
  'NOT IN': (string[] | number[]),
  'IS NOT': null
}

type ImmediateFilterMapper<T extends keyof ImmediateFilters> = T extends keyof ImmediateFilters ? [T, [ImmediateFilters[T]]] : never;

type extendedImmediateFilters = ImmediateFilterMapper<keyof ImmediateFilters>;

type DBTypeToString<T> = T extends bigint ? 'bigint' : T extends number ? 'number' : T extends string ? 'string' : T extends object ? 'json' : T extends undefined ? never : 'json';

type FilterBigIntIdKeys<T> = keyof T extends {id: bigint} ? never : keyof T extends {id: bigint}[] ? never : keyof T;

type KeysOfUnion<T> = T extends T ? keyof T: never;


type FilterBigIntIdProps<T> = {
  [K in keyof T as NonNullable<T[K]> extends {id: bigint} ? never : NonNullable<T[K]> extends {id: bigint}[] ? never : K]: K
}

type DBFieldsObject<T> = { [K in KeysOfUnion<FilterBigIntIdProps<T>>]:  { type: K extends keyof T ? DBTypeToString<T[K]> : never } };

export type DBImmediateFilter = {[key: string]: extendedImmediateFilters | [(string | number | bigint)]};

export type ModelsDefinition< T extends {} > = {
  define: (name: string, tableName: string, fields: DBFieldsObject<T>, options: {
    associate: (models: ModelObject) => void,
    defaultFilters?: (models: ModelObject) => Partial<DBModelToFilter<T>>,
    additionalFunctions?: {[key: string]: additionalFunction}
  }) => {
    addToOne: (model: AssociateModels, options: {
      name: string,
      myKey: string,
      foreignKey: string,
      filter?: DBImmediateFilter,
      with?: string[]
    }) => void
    addToMany: (model: AssociateModels, options: {
      name: string,
      myKey: string,
      foreignKey: string,
      filter?: DBImmediateFilter,
      with?: string[]
    }) => void
    addToManyThrough: (model: AssociateModels, options: {
      name: string,
      throughTable: string,
      myKey: string,
      myPivotKey: string,
      foreignPivotKey: string,
      foreignKey: string,
      pivotFilter?: DBImmediateFilter,
      filter?: DBImmediateFilter,
      with?: string[]
    }) => void
    addToOneThrough: (model: AssociateModels, options: {
      name: string,
      throughTable: string,
      myKey: string,
      myPivotKey: string,
      foreignPivotKey: string,
      foreignKey: string,
      pivotFilter?: DBImmediateFilter,
      filter?: DBImmediateFilter,
      with?: string[]
    }) => void
  }
}

export type ModelInstance<T> = T & {
  save: () => Promise<void>;
  delete: () => Promise<void>;
  naked: () => T;
};

type NoExtendObject = { [key: string | symbol | number]: never };

type DBTransaction = import('./index').DBTransaction;

export type TableModelCreateFunction<T, K extends keyof T = never> = (params: Pick<T, K> & Partial<Omit<T, K>>, transaction?: DBTransaction) => Promise<ModelInstance<T>>;

export type TableModelObject<T, K extends keyof T = never> = {
  find: (id: number | BigInt) => Promise<ModelInstance<T> | undefined>;
  create: TableModelCreateFunction<T, K>;
  upsert: (params: Partial<T>, conflictFields: string[]) => Promise<{inserted: boolean, instance: ModelInstance<T>}>;
  with: (...tables: TableModelObject<any, any>[]) => TableModelObject<T>;
  collect: (...fields: string[]) => TableModelObject<T>;
  where: (...wheres: { [key: string]: any }[]) => TableModelObject<T>;
  order: (...orders: (string|string[])[]) => TableModelObject<T>;
  limit: (number: number) => TableModelObject<T>;
  cache: (key: string) => TableModelObject<T>;
  get: (params: DBRetirevalValueObject) => Promise<T[]>;
  getOne: (params: DBRetirevalValueObject) => Promise<T | undefined>;
  makeInstance: (values: T) => ModelInstance<T>;
};
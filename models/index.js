const fs = require('fs');
const path = require('path');
const winston = require('./../config/winston.js');
const RustTypes = require('./../lib/RustTypes.js');
const {ok, err} = RustTypes;
// var Sequelize = require('sequelize');
const basename = 'index.js';
// var env       = process.env.NODE_ENV || 'development';
const DB = require('./../lib/DB.js');

/** @type {Map<string, string>} */
const tableNameToModelNameMap = new Map();

/**
 * @template T
 * @typedef {T &
 *   {tableName: string, uniqueConstraints: {constraint_name: string, columns: string[]}[],
 *   uniqueIndexes: {index_name: string, index_def: string}[]}
 * } ModelWithTableDefinitionProperties
 */

/**
 * @param {string | number | bigint | boolean | null | undefined | string[] | number[]} value
 * @return {string | number | boolean | null}
 */
function escapeDatabaseValue(value) {
  if (typeof value === 'string') {
    return value.replace(/'/g, '\'\'');
  } else if (typeof value === 'number') {
    return value;
  } else if (typeof value === 'boolean') {
    return value;
  } else if (typeof value === 'undefined') {
    return null;
  } else if (value === null) {
    return null;
  } else if (typeof value === 'bigint') {
    return value.toString();
  } else if (Array.isArray(value)) {
    return value.map(convertToDatabaseValue).join(',');
  }
  return value;
}

/**
 * @param {string | number | bigint | boolean | null | undefined | string[] | number[]} value
 * @return {string | number | boolean | null}
 */
function convertToDatabaseValue(value) {
  if (Array.isArray(value)) {
    return value.map(convertToDatabaseValue).join(',');
  } else if (typeof value === 'string') {
    return '\''+escapeDatabaseValue(value)+ '\'';
  } else {
    return escapeDatabaseValue(value);
  }
}

/**
 * @typedef {import('./types').DBType} DBType
 */

/**
 * define type for BaseSelectQuery
 * @typedef {{
 * fields: string[] | undefined,
 * table: string,
 * type: 'select',
 * join: (JoinQuery & {text: string, tempTableName: string, tempJoinKey: string})[],
 * where: any,
 * order: string[],
 * limit: number | undefined,
 * count: true | undefined
 * }} BaseSelectQuery
 */

/**
 * define type for HasOneSelectQuery
 * @typedef {{
 * name: string,
 * fields: string[] | undefined,
 * table: string,
 * type: 'single',
 * join: (JoinQuery & {text: string, tempTableName: string, tempJoinKey: string})[],
 * where: any,
 * order: string[],
 * limit: 1,
 * count: true | undefined,
 * foreignKey: string,
 * myKey: string
 * }} HasOneSelectQuery
 */

/**
 * define type for HasManySelectQuery
 * @typedef {{
 * name: string,
 * fields: string[] | undefined,
 * table: string,
 * type: 'many',
 * join: (JoinQuery & {text: string, tempTableName: string, tempJoinKey: string})[],
 * where: any,
 * order: string[],
 * limit: number | undefined,
 * count: true | undefined,
 * foreignKey: string,
 * myKey: string
 * }} HasManySelectQuery
 */

/**
 * define type for HasManyThroughSelectQuery
 * @typedef {{
 * name: string,
 * fields: string[] | undefined,
 * table: string,
 * throughTable: string,
 * type: 'manyThrough',
 * join: (JoinQuery & {text: string, tempTableName: string, tempJoinKey: string})[],
 * where: any,
 * order: string[],
 * limit: number | undefined,
 * count: true | undefined,
 * foreignKey: string,
 * myKey: string,
 * foreignPivotKey: string,
 * myPivotKey: string,
 * pivotFilter: import('./types.js').DBImmediateFilter | undefined
 * }} HasManyThroughSelectQuery
 */

/**
 * define type for HasOneThroughSelectQuery
 * @typedef {{
 * name: string,
 * fields: string[] | undefined,
 * table: string,
 * throughTable: string,
 * type: 'singleThrough',
 * join: (JoinQuery & {text: string, tempTableName: string, tempJoinKey: string})[],
 * where: any,
 * order: string[],
 * limit: 1,
 * count: true | undefined,
 * foreignKey: string,
 * myKey: string,
 * foreignPivotKey: string,
 * myPivotKey: string,
 * pivotFilter: import('./types.js').DBImmediateFilter | undefined
 * }} HasOneThroughSelectQuery
 */

/**
 * @template T
 * @typedef {Omit<T, 'join' | 'where' | 'order' | 'limit' | 'type' | 'table' | 'fields' | 'count'> &
*   {filter?: import('./types.js').DBImmediateFilter | undefined, join?: string[]}} JoinBuilderInput
*/

/**
* @template T
* @typedef {Omit<T, 'join' | 'where' | 'order' | 'limit' | 'fields' | 'count'> &
*  {filter?: import('./types.js').DBImmediateFilter | undefined}} JoinBuilderOutput
*/

// given an object T and a union of keys K, return an object where the keys in K are optional
/**
* @template T
* @template {keyof T} K
* @typedef {Omit<T, K> & Partial<Pick<T, K>>} OptionalKeys
*/

// instead of omitting the join, where, order, limit, and fields properties we are going to make them optional
/**
* @template {SelectQuery} T
* @typedef {OptionalKeys<T, 'join' | 'where' | 'order' | 'limit' | 'fields' | 'count'>} OptionalSelectQuery
*/

/**
 * @typedef {HasOneSelectQuery | HasManySelectQuery | HasManyThroughSelectQuery | HasOneThroughSelectQuery} JoinQuery
 */

/**
 * @typedef {OptionalSelectQuery<HasOneSelectQuery>
 * | OptionalSelectQuery<HasManySelectQuery>
 * | OptionalSelectQuery<HasManyThroughSelectQuery>
 * | OptionalSelectQuery<HasOneThroughSelectQuery>} OptionalJoinQuery
 */

/**
 * @typedef {HasOneSelectQuery | HasManySelectQuery | HasManyThroughSelectQuery | HasOneThroughSelectQuery | BaseSelectQuery} SelectQuery
 */

/**
 * @param {OptionalJoinQuery} obj
 * @param {number} tCount
 * @return {number}
 */
function genSubSelect(obj, tCount) {
  const tempTableName = 'T' + tCount;
  const tempJoinKey = 'T' + tCount + '_match';
  const output = Object.assign(obj, {
    tempTableName,
    tempJoinKey,
    text: ''
  });
  const join = obj.join || [];
  if (Array(join) && join.length > 0) {
    for (const joiner of join) {
      tCount = genSubSelect(joiner, tCount + 1);
    }
  }
  let fields = obj.fields;
  if (typeof fields === 'undefined' || !Array.isArray(fields)) {
    const tableName = obj.table;
    const modelName = /** @type {Exclude<keyof ModelObject, '_DB'>} */(tableNameToModelNameMap.get(tableName));
    if (modelName) {
      const model = /** @type {Model} */(/** @type {any} */(models)[modelName]);
      if (model) {
        const modelFields = model.fields;
        fields = Object.keys(modelFields).map((x) => {
          if (modelFields[x].type === 'bigint') {
            // we need to handle the bigint type differently because it is not supported by the json type
            return `(${obj.table}.${x}::TEXT || ':bigint') AS ${x}`;
          } else {
            // we can just return the column name
            return obj.table + '.' + x;
          }
        });
      } else {
        fields = [obj.table + '.*'];
      }
    } else {
      fields = [obj.table + '.*'];
    }
  } else {
    const tableName = obj.table;
    const modelName = /** @type {Exclude<keyof ModelObject, '_DB'>} */(tableNameToModelNameMap.get(tableName));
    if (modelName) {
      const model = /** @type {Model} */(/** @type {any} */(models)[modelName]);
      if (model) {
        fields = fields.map((x) => {
          const fieldName = /** @type {keyof typeof model.fields} */(x);
          const fieldDefintion = model.fields[fieldName];
          if (fieldDefintion.type === 'bigint') {
            // we need to handle the bigint type differently because it is not supported by the json type
            return `(${obj.table}.${fieldName}::TEXT || ':bigint') AS ${fieldName}`;
          } else {
            // we can just return the column name
            return obj.table + '.' + fieldName;
          }
        });
      }
    }
  }
  if (obj.count) {
    fields = ['id'];
  }
  if (obj.type === 'single' || obj.type === 'many') {
    fields.push(obj.table + '.' + obj.foreignKey + ' AS '+output.tempJoinKey);
    output.text = 'Select ' + fields.join(', ');
    if (join.length > 0) {
      for (const joiner of join) {
        if (joiner.type === 'single' || joiner.type === 'singleThrough') {
          output.text += ', ' + joiner.tempTableName + '.Val AS ' + joiner.name;
        } else if (joiner.type === 'many' || joiner.type === 'manyThrough') {
          if (joiner.count) {
            ', COALESCE(' + joiner.tempTableName + '.Val,0) AS ' + joiner.name;
          } else {
            output.text += ', COALESCE(' + joiner.tempTableName + '.Val,\'[]\'::json) AS ' + joiner.name;
          }
        }
      }
    }
    output.text += ' FROM ' + obj.table;
    if (join.length > 0) {
      for (const joiner of join) {
        output.text +=
          ' LEFT OUTER JOIN (' + joiner.text + ') ' + joiner.tempTableName + ' ON ' +
          joiner.tempTableName + '.' + joiner.tempJoinKey + ' = ' + obj.table + '.' + joiner.myKey;
      }
    }
    if (obj.where && Object.keys(obj.where).length > 0) {
      output.text += ' WHERE';
      const keys = Object.keys(obj.where);
      for (const [keyIndex, key] of keys.entries()) {
        if (keyIndex !== 0) output.text += ' AND';
        output.text += ' ' + obj.table + '.' + key;
        if (Array.isArray(obj.where[key])) {
          if (obj.where[key].length == 2) {
            if (/^in$/i.test(obj.where[key][0])) {
              // if the second value is an array then we are going to use the list parameter
              if (Array.isArray(obj.where[key][1])) {
                output.text += ' IN (' + convertToDatabaseValue(obj.where[key][1]) + ')';
              } else {
                output.text += ' IN (${' + obj.where[key][1] + ':list})';
              }
            } else if (/^notin$/i.test(obj.where[key][0])) {
              // if the second value is an array then we are going to use the list parameter
              if (Array.isArray(obj.where[key][1])) {
                output.text += ' NOT IN (' + convertToDatabaseValue(obj.where[key][1]) + ')';
              } else {
                output.text += ' NOT IN (${' + obj.where[key][1] + ':list})';
              }
            } else if ((obj.where[key][0] + '').toLowerCase().trim() === 'between') {
              // if the second value is an array then we are going to use the parameter
              if (Array.isArray(obj.where[key][1])) {
                const lowHighObj = obj.where[key][1][0];
                output.text += ' BETWEEN ' + convertToDatabaseValue(lowHighObj.low) + ' AND ' + convertToDatabaseValue(lowHighObj.high);
              } else {
                output.text += ' BETWEEN ${' + obj.where[key][1] + '.low} AND ${' + obj.where[key][1] + '.high}';
              }
            } else {
              if (Array.isArray(obj.where[key][1])) {
                output.text += ' ' + obj.where[key][0] + ' ' + convertToDatabaseValue(obj.where[key][1][0]);
              } else {
                output.text += ' ' + obj.where[key][0] + ' ${' + obj.where[key][1] + '}';
              }
            }
          } else if (obj.where[key].length == 1) {
            // the array holds a single value which is the value to been
            output.text += ' = ' + convertToDatabaseValue(obj.where[key][0]);
          } else {
            throw new Error('Invalid where clause');
          }
        } else {
          output.text += ' = ${' + obj.where[key] + '}';
        }
      }
    }
    if (obj.order && obj.order.length > 0) {
      output.text += ' ORDER BY '+obj.order.join(', ');
    }
    if (obj.limit) {
      output.text += ' LIMIT ' + obj.limit;
    }
    const subTable = 'T' + (tCount + 1);
    if (obj.type === 'single') {
      output.text = 'SELECT to_json('+subTable+'.*) AS Val, '+subTable+'.'+output.tempJoinKey+' FROM (' + output.text + ') ' + subTable;
    } else if (obj.type === 'many') {
      if (obj.count) {
        output.text = 'SELECT COUNT('+subTable+'.id) AS Val, '+subTable+'.'+output.tempJoinKey+
            ' FROM (' + output.text + ') ' + subTable + ' GROUP BY '+subTable+'.'+output.tempJoinKey;
      } else {
        output.text = 'SELECT json_agg(to_json('+subTable+'.*)) AS Val, '+subTable+'.'+output.tempJoinKey+
            ' FROM (' + output.text + ') ' + subTable + ' GROUP BY '+subTable+'.'+output.tempJoinKey;
      }
    }
  } else if (obj.type === 'manyThrough' || obj.type === 'singleThrough') {
    fields.push(obj.throughTable + '.' + obj.myPivotKey + ' AS '+output.tempJoinKey);
    output.text = 'Select ' + fields.join(', ');
    if (join.length > 0) {
      for (const joiner of join) {
        if (joiner.type === 'single' || joiner.type === 'singleThrough') {
          output.text += ', ' + joiner.tempTableName + '.Val AS ' + joiner.name;
        } else if (joiner.type === 'many' || joiner.type === 'manyThrough') {
          if (joiner.count) {
            ', COALESCE(' + joiner.tempTableName + '.Val,0) AS ' + joiner.name;
          } else {
            output.text += ', COALESCE(' + joiner.tempTableName + '.Val,\'[]\'::json) AS ' + joiner.name;
          }
        }
      }
    }
    output.text += ' FROM ' + obj.table;
    output.text += ' LEFT OUTER JOIN ' + obj.throughTable +
        ' ON ' + obj.throughTable + '.' + obj.foreignPivotKey + ' = ' + obj.table + '.' + obj.foreignKey;
    if (join.length > 0) {
      for (const joiner of join) {
        output.text +=
          ' LEFT OUTER JOIN (' + joiner.text + ') ' + joiner.tempTableName + ' ON ' +
          joiner.tempTableName + '.' + joiner.tempJoinKey + ' = ' + obj.table + '.' + joiner.myKey;
      }
    }
    if (obj.where && Object.keys(obj.where).length > 0 || obj.pivotFilter && Object.keys(obj.pivotFilter).length > 0) {
      output.text += ' WHERE';
      if (obj.pivotFilter && Object.keys(obj.pivotFilter).length > 0) {
        const keys = Object.keys(obj.pivotFilter);
        for (const [keyIndex, key] of keys.entries()) {
          if (keyIndex !== 0) output.text += ' AND';
          output.text += ' ' + obj.throughTable + '.' + key;
          if (Array.isArray(obj.pivotFilter[key])) {
            const filter = obj.pivotFilter[key];
            if (filter.length == 2) {
              if (filter[0] === 'IN') {
                // if the second value is an array then we are going to use the list parameter
                if (Array.isArray(filter[1])) {
                  output.text += ' IN (' + convertToDatabaseValue(filter[1][0]) + ')';
                } else {
                  output.text += ' IN (${' + filter[1] + ':list})';
                }
              } else if (filter[0] === 'NOT IN') {
                // if the second value is an array then we are going to use the list parameter
                if (Array.isArray(filter[1])) {
                  output.text += ' NOT IN (' + convertToDatabaseValue(filter[1][0]) + ')';
                } else {
                  output.text += ' NOT IN (${' + filter[1] + ':list})';
                }
              } else if (filter[0] === 'BETWEEN') {
                // if the second value is an array then we are going to use the parameter
                if (Array.isArray(filter[1])) {
                  const lowHighObj = filter[1][0];
                  output.text += ' BETWEEN ' + convertToDatabaseValue(lowHighObj.low) + ' AND ' + convertToDatabaseValue(lowHighObj.high);
                } else {
                  output.text += ' BETWEEN ${' + filter[1] + '.low} AND ${' + filter[1] + '.high}';
                }
              } else if (filter[0] === 'NOT BETWEEN') {
                // if the second value is an array then we are going to use the parameter
                if (Array.isArray(filter[1])) {
                  const lowHighObj = filter[1][0];
                  output.text += ' NOT BETWEEN ' + convertToDatabaseValue(lowHighObj.low) + ' AND ' + convertToDatabaseValue(lowHighObj.high);
                } else {
                  output.text += ' NOT BETWEEN ${' + filter[1] + '.low} AND ${' + filter[1] + '.high}';
                }
              } else {
                if (Array.isArray(filter[1])) {
                  output.text += ' ' + filter[0] + ' ' + convertToDatabaseValue(filter[1][0]);
                } else {
                  output.text += ' ' + filter[0] + ' ${' + filter[1] + '}';
                }
              }
            } else if (filter.length == 1) {
              // the array holds a single value which is the value to been
              output.text += ' = ' + convertToDatabaseValue(filter[0]);
            } else {
              throw new Error('Invalid where clause');
            }
          } else {
            output.text += ' = ${' + obj.pivotFilter[key] + '}';
          }
        }
      }
      if (obj.where && Object.keys(obj.where).length > 0) {
        if (!output.text.endsWith('WHERE')) output.text += ' AND';
        const keys = Object.keys(obj.where);
        for (const [keyIndex, key] of keys.entries()) {
          if (keyIndex !== 0) output.text += ' AND';
          output.text += ' ' + obj.table + '.' + key;
          if (Array.isArray(obj.where[key])) {
            if (obj.where[key].length == 2) {
              if (obj.where[key][0].toUpperCase() === 'IN') {
                // if the second value is an array then we are going to use the list parameter
                if (Array.isArray(obj.where[key][1])) {
                  output.text += ' IN (' + convertToDatabaseValue(obj.where[key][1]) + ')';
                } else {
                  output.text += ' IN (${' + obj.where[key][1] + ':list})';
                }
              } else if (obj.where[key][0].toUpperCase() === 'NOT IN') {
                // if the second value is an array then we are going to use the list parameter
                if (Array.isArray(obj.where[key][1])) {
                  output.text += ' NOT IN (' + convertToDatabaseValue(obj.where[key][1]) + ')';
                } else {
                  output.text += ' NOT IN (${' + obj.where[key][1] + ':list})';
                }
              } else if ((obj.where[key][0] + '').toUpperCase() === 'BETWEEN') {
                // if the second value is an array then we are going to use the parameter
                if (Array.isArray(obj.where[key][1])) {
                  const lowHighObj = obj.where[key][1][0];
                  output.text += ' BETWEEN ' + convertToDatabaseValue(lowHighObj.low) + ' AND ' + convertToDatabaseValue(lowHighObj.high);
                } else {
                  output.text += ' BETWEEN ${' + obj.where[key][1] + '.low} AND ${' + obj.where[key][1] + '.high}';
                }
              } else if ((obj.where[key][0] + '').toUpperCase() === 'NOT BETWEEN') {
                // if the second value is an array then we are going to use the parameter
                if (Array.isArray(obj.where[key][1])) {
                  const lowHighObj = obj.where[key][1][0];
                  output.text += ' NOT BETWEEN ' + convertToDatabaseValue(lowHighObj.low) + ' AND ' + convertToDatabaseValue(lowHighObj.high);
                } else {
                  output.text += ' NOT BETWEEN ${' + obj.where[key][1] + '.low} AND ${' + obj.where[key][1] + '.high}';
                }
              } else {
                if (Array.isArray(obj.where[key][1])) {
                  output.text += ' ' + obj.where[key][0] + ' ' + convertToDatabaseValue(obj.where[key][1][0]);
                } else {
                  output.text += ' ' + obj.where[key][0] + ' ${' + obj.where[key][1] + '}';
                }
              }
            } else if (obj.where[key].length == 1) {
              // the array holds a single value which is the value to been
              output.text += ' = ' + convertToDatabaseValue(obj.where[key][0]);
            } else {
              throw new Error('Invalid where clause');
            }
          } else {
            output.text += ' = ${' + obj.where[key] + '}';
          }
        }
      }
    }
    if (obj.order && obj.order.length > 0) {
      output.text += ' ORDER BY '+obj.order.join(', ');
    }
    if (obj.limit) {
      output.text += ' LIMIT ' + obj.limit;
    }
    const subTable = 'T' + (tCount + 1);
    if (obj.type === 'singleThrough') {
      output.text = 'SELECT to_json('+subTable+'.*) AS Val, '+subTable+'.'+output.tempJoinKey+' FROM (' + output.text + ') ' + subTable;
    } else if (obj.type === 'manyThrough') {
      if (obj.count) {
        output.text = 'SELECT COUNT('+subTable+'.id) AS Val, '+subTable+'.'+output.tempJoinKey+
            ' FROM (' + output.text + ') ' + subTable + ' GROUP BY '+subTable+'.'+output.tempJoinKey;
      } else {
        output.text = 'SELECT json_agg(to_json('+subTable+'.*)) AS Val, '+subTable+'.'+output.tempJoinKey+
            ' FROM (' + output.text + ') ' + subTable +' GROUP BY '+subTable+'.'+output.tempJoinKey;
      }
    }
  }
  return tCount + 1;
}

/**
 * @param {OptionalSelectQuery<BaseSelectQuery>} obj
 */
function genSelect(obj) {
  let tCount = 0;
  const join = obj.join || [];
  if (Array(join) && join.length > 0) {
    for (const joiner of join) {
      tCount = genSubSelect(joiner, tCount + 1);
    }
  }
  let fields = obj.fields;
  if (typeof fields === 'undefined') {
    const tableName = obj.table;
    const modelName = /** @type {Exclude<keyof ModelObject, '_DB'>} */(tableNameToModelNameMap.get(tableName));
    if (modelName) {
      const model = /** @type {Model} */(/** @type {any} */(models)[modelName]);
      if (model) {
        const modelFields = model.fields;
        fields = Object.keys(modelFields).map((x) => {
          if (modelFields[x].type === 'bigint') {
            // we need to handle the bigint type differently because it is not supported by the json type
            // we also convert to json to cause the bigint to be parsed via the custom json parser
            return `to_json(${obj.table}.${x}::TEXT || ':bigint') AS ${x}`;
          } else {
            // we can just return the column name
            return obj.table + '.' + x;
          }
        });
      } else {
        fields = [obj.table + '.*'];
      }
    } else {
      fields = [obj.table + '.*'];
    }
  } else {
    const tableName = obj.table;
    const modelName = /** @type {Exclude<keyof ModelObject, '_DB'>} */(tableNameToModelNameMap.get(tableName));
    if (modelName) {
      const model = /** @type {Model} */(/** @type {any} */(models)[modelName]);
      if (model) {
        fields = fields.map((x) => {
          const fieldName = /** @type {keyof typeof model.fields} */(x);
          const fieldDefintion = model.fields[fieldName];
          if (fieldDefintion.type === 'bigint') {
            // we need to handle the bigint type differently because it is not supported by the json type
            // we also convert to json to cause the bigint to be parsed via the custom json parser
            return `to_json(${obj.table}.${fieldName}::TEXT || ':bigint') AS ${fieldName}`;
          } else {
            // we can just return the column name
            return obj.table + '.' + fieldName;
          }
        });
      }
    }
  }
  let out = 'Select ';
  out += fields.join(', ');
  if (join.length > 0) {
    for (const joiner of join) {
      if (joiner.type === 'single' || joiner.type === 'singleThrough') {
        out += ', ' + joiner.tempTableName + '.Val AS ' + joiner.name;
      } else if (joiner.type === 'many' || joiner.type === 'manyThrough') {
        if (joiner.count) {
          out += ', COALESCE(' + joiner.tempTableName + '.Val,0) AS ' + joiner.name;
        } else {
          out += ', COALESCE(' + joiner.tempTableName + '.Val,\'[]\'::json) AS ' + joiner.name;
        }
      }
    }
  }
  out += ' FROM ' + obj.table;
  if (join.length > 0) {
    for (const joiner of join) {
      out +=
        ' LEFT OUTER JOIN (' + joiner.text + ') ' + joiner.tempTableName + ' ON ' +
        joiner.tempTableName + '.' + joiner.tempJoinKey + ' = ' + obj.table + '.' + joiner.myKey;
    }
  }
  if (obj.where && Object.keys(obj.where).length > 0) {
    out += ' WHERE';
    const keys = Object.keys(obj.where);
    for (const [keyIndex, key] of keys.entries()) {
      if (keyIndex !== 0) out += ' AND';
      out += ' ' + obj.table + '.' + key;
      if (Array.isArray(obj.where[key])) {
        if (obj.where[key].length == 2) {
          if (obj.where[key][0].toUpperCase() === 'IN') {
            // if the second value is an array then we are going to use the list parameter
            if (Array.isArray(obj.where[key][1])) {
              out += ' IN (' + convertToDatabaseValue(obj.where[key][1]) + ')';
            } else {
              out += ' IN (${' + obj.where[key][1] + ':list})';
            }
          } else if (obj.where[key][0].toUpperCase() === 'NOT IN') {
            // if the second value is an array then we are going to use the list parameter
            if (Array.isArray(obj.where[key][1])) {
              out += ' NOT IN (' + convertToDatabaseValue(obj.where[key][1]) + ')';
            } else {
              out += ' NOT IN (${' + obj.where[key][1] + ':list})';
            }
          } else if ((obj.where[key][0] + '').toUpperCase() === 'BETWEEN') {
            // if the second value is an array then we are going to use the parameter
            if (Array.isArray(obj.where[key][1])) {
              const lowHighObj = obj.where[key][1][0];
              out += ' BETWEEN ' + convertToDatabaseValue(lowHighObj.low) + ' AND ' + convertToDatabaseValue(lowHighObj.high);
            } else {
              out += ' BETWEEN ${' + obj.where[key][1] + '.low} AND ${' + obj.where[key][1] + '.high}';
            }
          } else if ((obj.where[key][0] + '').toUpperCase() === 'NOT BETWEEN') {
            // if the second value is an array then we are going to use the parameter
            if (Array.isArray(obj.where[key][1])) {
              const lowHighObj = obj.where[key][1][0];
              out += ' NOT BETWEEN ' + convertToDatabaseValue(lowHighObj.low) + ' AND ' + convertToDatabaseValue(lowHighObj.high);
            } else {
              out += ' NOT BETWEEN ${' + obj.where[key][1] + '.low} AND ${' + obj.where[key][1] + '.high}';
            }
          } else {
            if (Array.isArray(obj.where[key][1])) {
              out += ' ' + obj.where[key][0] + ' ' + convertToDatabaseValue(obj.where[key][1][0]);
            } else {
              out += ' ' + obj.where[key][0] + ' ${' + obj.where[key][1] + '}';
            }
          }
        } else if (obj.where[key].length == 1) {
          // the array holds a single value which is the value to be used without referencing a parameter
          out += ' = ' + convertToDatabaseValue(obj.where[key][0]);
        }
      } else {
        out += ' = ${' + obj.where[key] + '}';
      }
    }
  }
  if (obj.order && obj.order.length > 0) {
    out += ' ORDER BY '+obj.order.join(', ');
  }
  if (obj.limit) {
    out += ' Limit ' + obj.limit;
  }
  return out + ';';
}

/***/
class Instance {
  /**
   * @param {Model} model
   * @param {any} values
   */
  constructor(model, values) {
    this._model = model;
    const fields = model.fields;
    const fieldNames = Object.keys(fields);
    for (const fieldName of fieldNames) {
      this[/** @type {keyof typeof fields & keyof typeof this} */(fieldName)] = values[fieldName];
    }
  }

  /**
   * @param {any} transaction
   */
  save(transaction) {
    const _self = this;
    let q = DB.any;
    /**
     * @param {any} instance
     */
    const afterSave = function(instance) {
      return () => {
        const callbacks = _self._model._afterSaveListeners;
        for (const callback of callbacks) {
          callback(instance);
        }
      };
    };
    if (transaction) {
      q = transaction.query;
    }
    // @ts-ignore
    if (typeof this.id === 'undefined') {
      /** @type {any[]} */
      const values = [];
      const repStack = [];
      const fields = _self._model.fields;
      const fieldNames = Object.keys(fields);
      /** @type {(keyof typeof fields & keyof typeof this)[]} */
      const useFields = [];
      for (const rawFieldName of fieldNames) {
        const fieldName = /** @type {keyof typeof fields & keyof typeof this} */(rawFieldName);
        const fieldDefinition = fields[fieldName];
        const fieldType = fieldDefinition.type;
        const pgPromiseFilter = fieldType === 'json' ? ':json' : '';
        if (typeof _self[fieldName] !== 'undefined') {
          useFields.push(fieldName);
          values.push((Array.isArray(_self[fieldName]) && pgPromiseFilter !== ':json') ?JSON.stringify(_self[fieldName]):_self[fieldName]);
          repStack.push('$' + (repStack.length + 1)+pgPromiseFilter);
        }
      }
      return new Promise(async (resolve) => {
        const ret = await q('INSERT INTO ' + _self._model.table + '(' + useFields.join() + ') VALUES (' + repStack.length + ') RETURNING *;', values);
        const data = ret[0];
        // eslint-disable-next-line no-shadow
        const fields = _self._model.fields;
        // eslint-disable-next-line no-shadow
        const fieldNames = Object.keys(fields);
        for (const rawFieldName of fieldNames) {
          const fieldName = /** @type {keyof typeof fields & keyof typeof this} */(rawFieldName);
          _self[fieldName] = data[fieldName];
        }
        resolve(_self);
        if (transaction) {
          transaction.afterCommit(afterSave(_self));
        } else {
          afterSave(_self)();
        }
      });
    } else { // this is nothing but an update
      // @ts-ignore
      const values = [];
      const fields = _self._model.fields;
      const fieldNames = Object.keys(fields);
      let repString = '';
      for (const rawFieldName of fieldNames) {
        const fieldName = /** @type {keyof typeof fields & keyof typeof this} */(rawFieldName);
        const fieldDefinition = fields[fieldName];
        const fieldType = fieldDefinition.type;
        const pgPromiseFilter = fieldType === 'json' ? ':json' : '';
        if (typeof _self[fieldName] !== 'undefined') {
          values.push((Array.isArray(_self[fieldName]) && pgPromiseFilter !== ':json') ?JSON.stringify(_self[fieldName]):_self[fieldName]);
          if (values.length > 1) {
            repString += ',';
          }
          repString += fieldName + ' = $' + (values.length)+pgPromiseFilter;
        }
      }
      // @ts-ignore
      values.push(_self.id);
      return new Promise(async (resolve) => {
        // @ts-ignore
        await q('Update ' + _self._model.table + ' Set ' + repString + ' WHERE id = $' + (values.length) + ';', values);
        resolve(_self);
        if (transaction) {
          transaction.afterCommit(afterSave(_self));
        } else {
          afterSave(_self)();
        }
      });
    }
  }

  /**
   * @param {any} transaction
   */
  delete(transaction) {
    const _self = this;
    return new Promise(async (resolve, reject) => {
      let q = DB.any;
      // @ts-ignore
      const afterDelete = function(instance) {
        return () => {
          const callbacks = _self._model._afterDeleteListeners;
          for (const callback of callbacks) {
            callback(instance);
          }
        };
      };
      if (transaction) {
        q = transaction.query;
      }
      // @ts-ignore
      if (typeof _self.id !== 'undefined') {
        // @ts-ignore
        const ret = await q('Delete FROM ' + _self._model.table + ' WHERE id = $1;', [_self.id]);
        resolve(ret);
        if (transaction) {
          transaction.afterCommit(afterDelete(_self));
        } else {
          afterDelete(_self)();
        }
      } else {
        reject(new Error(_self._model.name + ' id is undefined'));
      }
    });
  }

  /**
   * @return {any}
   */
  naked() {
    const _self = this;
    /** @type {any} */
    const out = {};
    const fields = _self._model.fields;
    const fieldNames = Object.keys(fields);
    for (const rawFieldName of fieldNames) {
      const fieldName = /** @type {keyof typeof fields & keyof typeof this} */(rawFieldName);
      out[fieldName] = _self[fieldName];
    }
    return out;
  }
}

/***/
class builder {
  /**
   * @param {OptionalSelectQuery<SelectQuery>} table
   */
  constructor(table) {
    this.table = table;
  }

  /**
   * @param {any[]} tables
   */
  with(...tables) {
    if (typeof this.table.join === 'undefined') {
      this.table.join = [];
    }
    for (const table of tables) {
      let appendTable = table;
      if (table instanceof builder) {
        appendTable = table.table;
      }
      this.table.join.push(appendTable);
    }
    return this;
  }

  /**
   * @param {any[]} fields
   */
  collect(...fields) {
    if (typeof this.table.fields === 'undefined') {
      this.table.fields = [];
    }
    for (const field of fields) {
      this.table.fields.push(field);
    }
    return this;
  }

  /**
   * @param {any[]} wheres
   */
  where(...wheres) {
    if (typeof this.table.where === 'undefined') {
      this.table.where = {};
    }
    for (const where of wheres) {
      const keys = Object.keys(where);
      for (const key of keys) {
        this.table.where[key] = where[key];
      }
    }
    return this;
  }

  /**
   * @param {(string[] | string)[]} orders
   */
  order(...orders) {
    if (typeof this.table.order === 'undefined') {
      this.table.order = [];
    }
    for (const orderTemplates of orders) {
      if (typeof orderTemplates === 'string') {
        if (!orderTemplates.startsWith(this.table.table + '.')) {
          this.table.order.push(this.table.table + '.' + orderTemplates);
        } else {
          this.table.order.push(orderTemplates);
        }
      } else {
        for (const orderTemplate of orderTemplates) {
          if (!orderTemplate.startsWith(this.table.table + '.')) {
            this.table.order.push(this.table.table + '.' + orderTemplate);
          } else {
            this.table.order.push(orderTemplate);
          }
        }
      }
    }
    return this;
  }

  /**
   * @param {number} number
   */
  limit(number) {
    this.table.limit = Math.floor(number);
    return this;
  }

  /**
   * Count
   */
  count() {
    this.table.count = true;
    return this;
  }

  /**
   * @param {any} params
   */
  async get(params) {
    // @ts-ignore
    const text = genSelect(this.table);
    try {
      return await new Promise((resolve, reject) => {
        DB.any(text, params).then((values)=>{
          resolve(values);
        }).catch((e) => {
          winston.unknownError(e);
          reject(e);
        });
      });
    } catch (e) {
      // @ts-ignore
      throw new Error(e.message + '\n' + text);
    }
  }

  /**
   * @param {any} params
   */
  async getOne(params) {
    return (await this.limit(1).get(params))[0];
  }
}

/***/
class Model {
  /** @type {{constraint_name: string, columns: string[]}[]} */
  uniqueConstraints;
  /** @type {{index_name: string, index_def: string}[]} */
  uniqueIndexes;
  /**
   * @param {string} name
   * @param {string} table
   * @param {{[key: string]: {type: DBType}}} fields
   * @param {any} opts
   */
  constructor(name, table, fields, opts) {
    this.name = name;
    this.fields = fields;
    this.table = table;
    this.opts = opts;
    this.defaultFilters = (opts.defaultFilters || (() => {
      return {};
    }))();
    /** @type {any[]} */
    this._afterCreateListeners = [];
    /** @type {any[]} */
    this._afterSaveListeners = [];
    /** @type {any[]} */
    this._afterDeleteListeners = [];
  }

  /**
   * @param {any} func
   */
  afterSave(func) {
    if (typeof func == 'function') {
      this._afterSaveListeners.push(func);
    }
  }

  /**
   * @param {any} func
   */
  afterCreate(func) {
    if (typeof func == 'function') {
      this._afterCreateListeners.push(func);
    }
  }

  /**
   * @param {any} func
   */
  afterDelete(func) {
    if (typeof func == 'function') {
      this._afterDeleteListeners.push(func);
    }
  }

  /**
   * @param {any} awayModel
   * @param {JoinBuilderInput<HasManyThroughSelectQuery>} opts
   */
  addToManyThrough(awayModel, opts) {
    Object.defineProperty(this, opts.name, {
      get: function() {
        /** @type {JoinBuilderOutput<HasManyThroughSelectQuery>} */
        const hasManyThroughBuilderTemplate = {
          name: opts.name,
          table: awayModel.table,
          throughTable: opts.throughTable,
          type: 'manyThrough',
          foreignKey: opts.foreignKey,
          myKey: opts.myKey,
          foreignPivotKey: opts.foreignPivotKey,
          myPivotKey: opts.myPivotKey,
          pivotFilter: opts.pivotFilter || {}
        };
        const output = new builder(hasManyThroughBuilderTemplate).where(awayModel.defaultFilters);
        if (opts.filter) {
          output.where(opts.filter);
        }
        if (opts.join) {
          for (const join of opts.join) {
            output.with(awayModel[join]);
          }
        }
        return output;
      }
    });
  }

  /**
   * @param {any} awayModel
   * @param {JoinBuilderInput<HasOneThroughSelectQuery>} opts
   */
  addToOneThrough(awayModel, opts) {
    Object.defineProperty(this, opts.name, {
      get: function() {
        /** @type {JoinBuilderOutput<HasOneThroughSelectQuery>} */
        const hasOneThroughBuilderTemplate = {
          name: opts.name,
          table: awayModel.table,
          throughTable: opts.throughTable,
          type: 'singleThrough',
          foreignKey: opts.foreignKey,
          myKey: opts.myKey,
          foreignPivotKey: opts.foreignPivotKey,
          myPivotKey: opts.myPivotKey,
          pivotFilter: opts.pivotFilter || {}
        };
        const output = new builder(hasOneThroughBuilderTemplate).where(awayModel.defaultFilters);
        if (opts.filter) {
          output.where(opts.filter);
        }
        if (opts.join) {
          for (const join of opts.join) {
            output.with(awayModel[join]);
          }
        }
        return output;
      }
    });
  }

  /**
   * @param {any} awayModel
   * @param {JoinBuilderInput<HasOneSelectQuery>} opts
   */
  addToOne(awayModel, opts) {
    Object.defineProperty(this, opts.name, {
      get: function() {
        /** @type {JoinBuilderOutput<HasOneSelectQuery>} */
        const hasOneBuilderTemplate = {
          name: opts.name,
          table: awayModel.table,
          type: 'single',
          foreignKey: opts.foreignKey,
          myKey: opts.myKey
        };
        const output = new builder(hasOneBuilderTemplate).where(awayModel.defaultFilters);
        if (opts.filter) {
          output.where(opts.filter);
        }
        if (opts.join) {
          for (const join of opts.join) {
            output.with(awayModel[join]);
          }
        }
        return output;
      }
    });
  }

  /**
   * @param {any} awayModel
   * @param {JoinBuilderInput<HasManySelectQuery>} opts
   */
  addToMany(awayModel, opts) {
    Object.defineProperty(this, opts.name, {
      get: function() {
        /** @type {JoinBuilderOutput<HasManySelectQuery>} */
        const hasManyBuilderTemplate = {
          name: opts.name,
          table: awayModel.table,
          type: 'many',
          foreignKey: opts.foreignKey,
          myKey: opts.myKey
        };
        const output = new builder(hasManyBuilderTemplate).where(awayModel.defaultFilters);
        if (opts.filter) {
          output.where(opts.filter);
        }
        if (opts.join) {
          for (const join of opts.join) {
            output.with(awayModel[join]);
          }
        }
        return output;
      }
    });
  }

  /**
   * @param {any} params
   * @param {any} transaction
   */
  create(params, transaction) {
    const _self = this;
    // @ts-ignore
    const nameStack = [];
    // @ts-ignore
    const valueStack = [];
    // @ts-ignore
    const repStack = [];
    const fields = this.fields;
    const fieldNames = Object.keys(fields);
    for (const rawFieldName of fieldNames) {
      const fieldName = /** @type {keyof typeof fields & keyof typeof params} */(rawFieldName);
      const fieldDefinition = fields[fieldName];
      const fieldType = fieldDefinition.type;
      const pgPromiseFilter = fieldType === 'json' ? ':json' : '';
      if (typeof params[fieldName] !== 'undefined') {
        nameStack.push(fieldName);
        valueStack.push(params[fieldName]);
        repStack.push('$' + (repStack.length + 1)+pgPromiseFilter);
      }
    }
    return new Promise(async (resolve, reject) => {
      let data = [];
      let out = {};
      let q = DB.any;
      if (transaction) {
        q = transaction.query;
      }
      // @ts-ignore
      const afterCreate = function(instance) {
        return () => {
          const callbacks = _self._afterCreateListeners;
          for (const callback of callbacks) {
            callback(instance);
          }
        };
      };
      try {
        // @ts-ignore
        data = await q('INSERT INTO ' + _self.table + '(' + nameStack.join() + ') VALUES (' + repStack.join() + ') RETURNING *;', valueStack);
        out = new Instance(_self, data[0]);
        resolve(out);
        if (transaction) {
          transaction.afterCommit(afterCreate(out));
        } else {
          afterCreate(out)();
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * @param {number | bigint} id
   */
  find(id) {
    const _self = this;
    return DB.task(function(t) {
      return t.batch([
        t.oneOrNone('SELECT * FROM ' + _self.table + ' WHERE id = $1;', [BigInt(id.toString())])
      ]);
    }).then(function(data) {
      if (data && data[0]) {
        return new Instance(_self, data[0]);
      } else {
        return undefined;
      }
    });
  }

  /**
   * @param {any} params
   */
  with(...params) {
    /** @type {OptionalSelectQuery<BaseSelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).with(...params);
  }

  /**
   * @param {any} params
   */
  collect(...params) {
    /** @type {OptionalSelectQuery<SelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).collect(...params);
  }

  /**
   * @param {any} params
   */
  where(...params) {
    /** @type {OptionalSelectQuery<BaseSelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).where(...params);
  }

  /**
   * @param {(string[] | string)[]} params
   */
  order(...params) {
    /** @type {OptionalSelectQuery<BaseSelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).order(...params);
  }

  /**
   * @param {number} params
   */
  limit(params) {
    /** @type {OptionalSelectQuery<BaseSelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).limit(params);
  }

  /**
   */
  count() {
    /** @type {OptionalSelectQuery<BaseSelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).count();
  }


  /**
   * @param {any} params
   */
  get(params) {
    /** @type {OptionalSelectQuery<BaseSelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).get(params);
  }

  /**
   * @param {any} params
   */
  getOne(params) {
    /** @type {OptionalSelectQuery<BaseSelectQuery>} */
    const obj = {
      table: this.table,
      type: 'select'
    };
    return new builder(obj).where(this.defaultFilters).getOne(params);
  }
}

/**
 */
class Transaction {
  /** @type {function[]} */
  _commitCallbacks = [];
  /** @type {function[]} */
  _rollbackCallbacks = [];
  query = DB.any;
  /**
   * @returns {Promise<RustTypes.Result<true>>}
   */
  commit = async function() {
    return ok(true);
  };
  /**
   * @param {any} _err
   * @returns {Promise<RustTypes.Result<true>>}
   */
  rollback = async function(_err) {
    return ok(true);
  };
  /**
   * @param {function} func
   */
  afterCommit(func) {
    if (typeof func == 'function') {
      this._commitCallbacks.push(func);
    }
  }
  /**
   * @param {function} func
   */
  afterRollback(func) {
    if (typeof func == 'function') {
      this._rollbackCallbacks.push(func);
    }
  }
}

/**
 * @typedef {Transaction} DBTransaction
 */

const models = {
  _DB: DB,
  instance: Instance,
  transaction: async function() {
    const out = new Transaction();
    DB.tx((t) => async function() {
      const invertion = {
        commit: () => {},
        /** @param {any} _err */
        rollback: (_err) => {},
        promise: new Promise((r) => r(true))
      };
      out.query = t.any;
      invertion.promise = new Promise((resolve, reject) => {
        // @ts-ignore
        invertion.commit = resolve;
        invertion.rollback = reject;
      });
      out.commit = async function() {
        try {
          invertion.commit();
          return ok(true);
        } catch (e) {
          return err(/** @type {Error} */(e));
        }
      };
      out.rollback = async function(error) {
        try {
          invertion.rollback(error);
          return ok(true);
        } catch (e) {
          return err(/** @type {Error} */(e));
        }
      };
      return invertion.promise;
    });
    return out;
  }
};

// @ts-ignore
models.define =/**
* @param {string} name
* @param {string} table
* @param {any[]} fields
* @param {any} opts
*/
function(name, table, fields, opts) {
  tableNameToModelNameMap.set(table, name);
  // @ts-ignore
  models[name] = new Model(name, table, fields, opts);
  // @ts-ignore
  return models[name];
};

fs
  .readdirSync(__dirname)
  .filter(function(file) {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(function(file) {
    require(path.join(__dirname, file))(models);
  });

Object.keys(models).forEach(function(modelName) {
  const modelsIndirect = /** @type {{[key: string]: any}} */(models);
  if (modelsIndirect[modelName].opts) {
    /**
     * @param {any} values
     */
    modelsIndirect[modelName].makeInstance = function(values) {
      return new Instance(modelsIndirect[modelName], values);
    };
  }
  if (modelsIndirect[modelName].opts && modelsIndirect[modelName].opts.associate) {
    modelsIndirect[modelName].opts.associate(modelsIndirect);
  }
  if (modelsIndirect[modelName].opts && modelsIndirect[modelName].opts.additionalFunctions) {
    const additionalFunctions = modelsIndirect[modelName].opts.additionalFunctions;
    const keys = Object.keys(additionalFunctions);
    for (const key of keys) {
      /**
       * @param {any[]} args
       */
      modelsIndirect[modelName][key] = function(...args) {
        return additionalFunctions[key](modelsIndirect, ...args);
      };
    }
  }
});

module.exports = Object.freeze(/** @type {ModelObject} */(models));

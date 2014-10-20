'use strict';

/**
 * Determine the type of a variable
 *
 *     type(x)
 *
 * @param {*} x
 * @return {String} type  Lower case type, for example 'number', 'string',
 *                        'array', 'date'.
 */
exports.type = function(x) {
  var type = typeof x;

  if (type === 'object') {
    if (x === null)           return 'null';
    if (Array.isArray(x))     return 'array';
    if (x instanceof Date)    return 'date';
    if (x instanceof Function)return 'function';
    if (x instanceof RegExp)  return 'regexp';

    // These should not be used in practice
    if (x instanceof Boolean) return 'boolean';
    if (x instanceof Number)  return 'number';
    if (x instanceof String)  return 'string';
  }

  return type;
};

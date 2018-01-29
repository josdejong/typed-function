/**
 * typed-function
 *
 * Type checking for JavaScript functions
 *
 * https://github.com/josdejong/typed-function
 */
'use strict';

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // OldNode. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like OldNode.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.typed = factory();
  }
}(this, function () {
  function ok (x) {
    return true;
  }

  /**
   * @typedef {{
   *   params: Param[],
   *   restParam: boolean
   * }} Signature
   *
   * @typedef {string[]} Param
   */

  // create a new instance of typed-function
  function create () {
    // data type tests
    var _types = [
      { name: 'number',    test: function (x) { return typeof x === 'number' } },
      { name: 'string',    test: function (x) { return typeof x === 'string' } },
      { name: 'boolean',   test: function (x) { return typeof x === 'boolean' } },
      { name: 'Function',  test: function (x) { return typeof x === 'function'} },
      { name: 'Array',     test: Array.isArray },
      { name: 'Date',      test: function (x) { return x instanceof Date } },
      { name: 'RegExp',    test: function (x) { return x instanceof RegExp } },
      { name: 'Object',    test: function (x) { return typeof x === 'object' } },
      { name: 'null',      test: function (x) { return x === null } },
      { name: 'undefined', test: function (x) { return x === undefined } },
      { name: 'any',       test: ok}
    ];

    // types which need to be ignored
    var _ignore = [];

    // type conversions
    var _conversions = [];

    // This is a temporary object, will be replaced with a typed function at the end
    var typed = {
      types: _types,
      conversions: _conversions,
      ignore: _ignore
    };

    /**
     * Find the test function for a type
     * @param {String} type
     * @return {function} Returns the test function of the type when found,
     *                    Throws a TypeError otherwise
     */
    function findTest (type) {
      var entry = typed.types.find(function (entry) {
        return entry.name === type;
      });

      if (entry) {
        return entry.test;
      }

      var hint = typed.types.find(function (entry) {
        return entry.name.toLowerCase() === type.toLowerCase();
      });

      throw new TypeError('Unknown type "' + type + '"' +
          (hint ? ('. Did you mean "' + hint.name + '"?') : ''));
    }

    /**
     * Parse a parameter like `string | number` into an array with types.
     * @param {string} param
     * @return {string[]}
     */
    function parseParam (param) {
      return param.split('|')
          .map(trim)
          .filter(notEmpty);

      // TODO: check existence of the params

      // TODO: order the params by their index in types to get normalized types?
    }

    /**
     * Stringify parameters in a normalized way
     * @param {Signature} params
     * @return {string}
     */
    function stringifyParams (params) {
      return params.params
          .map(function (param, index) {
            var restParam = (params.restParam && index === params.params.length - 1) ? '...' : '';
            return restParam + param.join('|');
          })
          .join(',');
    }

    /**
     * Parse a signature with comma separated parameters, like "number, string"
     * @param {string} signature
     * @return {Signature} params
     */
    function parseParams (signature) {
      var split = signature.split(',');
      var params = [];
      var restParam = false;

      signature.split(',').map(trim).forEach(function (param, index) {
        var rest = param.indexOf('...') === 0;
        if (rest) {
          if (index === split.length - 1) {
            restParam = true; // only allowed as for last parameter
          }
          else {
            throw new SyntaxError('Unexpected rest parameter "' + param + '": ' +
                'only allowed for the last parameter');
          }
        }

        params.push(parseParam(rest ? param.slice(3) : param));
      });

      return {
        params: params,
        restParam: restParam
      };
    }

    /**
     * Create a type test for a single parameter, which can have one or multiple
     * types.
     * @param {Param} param
     * @return {function(x: *) : boolean} Returns a test function
     */
    function compileParam(param) {
      if (param.length === 0) {
        // nothing to do
        return ok;
      }
      else if (param.length === 1) {
        return findTest(param[0]);
      }
      else if (param.length === 2) {
        var test0 = findTest(param[0]);
        var test1 = findTest(param[1]);
        return function or(x) {
          return test0(x) || test1(x);
        }
      }
      else { // types.length > 2
        var tests = param.map(function (type) {
          return findTest(type);
        })
        return function or(x) {
          for (var i = 0; i < tests.length; i++) {
            if (tests[i](x)) {
              return true;
            }
          }
          return false;
        }
      }
    }

    /**
     * Create a test for all parameters of a signature
     * @param {Signature} signature
     * @return {function(args: Array<*>) : boolean}
     */
    function compileParams(signature) {
      var tests, test0, test1;

      // TODO: implement conversions

      if (signature.restParam) { // variable arguments like '...number'
        tests = initial(signature.params).map(compileParam);
        var varIndex = tests.length;
        var lastTest = compileParam(last(signature.params));
        var testRestParam = function (args) {
          for (var i = varIndex; i < args.length; i++) {
            if (!lastTest(args[i])) {
              return false;
            }
          }
          return true;
        }

        return function testArgs(args) {
          for (var i = 0; i < tests.length; i++) {
            if (!tests[i](args[i])) {
              return false;
            }
          }
          return testRestParam(args) && (args.length >= varIndex + 1);
        };
      }
      else { // no variable arguments
        if (signature.params.length === 0) {
          return function testArgs(args) {
            return args.length === 0;
          };
        }
        else if (signature.params.length === 1) {
          test0 = compileParam(signature.params[0]);
          return function testArgs(args) {
            return test0(args[0]) && args.length === 1;
          };
        }
        else if (signature.params.length === 2) {
          test0 = compileParam(signature.params[0]);
          test1 = compileParam(signature.params[1]);
          return function testArgs(args) {
            return test0(args[0]) && test1(args[1]) && args.length === 2;
          };
        }
        else { // arguments.length > 2
          tests = signature.params.map(compileParam);
          return function testArgs(args) {
            for (var i = 0; i < tests.length; i++) {
              if (!tests[i](args[i])) {
                return false;
              }
            }
            return args.length === tests.length;
          };
        }
      }
    }

    function createError(name, args) {
      var typesList = Array.prototype.map.call(args, function (arg) {
        var entry = typed.types.find(function (entry) {
          return entry.test(arg);
        });
        return entry ? entry.name : 'unknown';
      });

      return new TypeError('Signature "' + typesList.join(', ') +
          '" doesn\'t match any of the defined signatures of function ' +
          (name || 'unnamed') + '.');
    }

    /**
     * @param {Signature} signature
     * @return {Signature | null} Returns a filtered copy of the signature,
     *                            or null when the signature is invalid
     *                            (when a parameter has no types left)
     */
    function filterIgnoredTypes (signature) {
      var filteredParams = [];

      for (var i = 0; i < signature.params.length; i++) {
        var param = signature.params[i].filter(notIgnore);
        if (param.length === 0) {
          return null;
        }
        filteredParams.push(param);
      }

      return {
        params: filteredParams,
        restParam: signature.restParam
      }
    }

    /**
     * Create a map with the name of a type as key and the index as value.
     * Used for sorting
     * @param {Array} types
     * @return {Object}
     */
    function createTypesIndexMap (types) {
      var typesIndexMap = {};

      types.forEach(function (type, index) {
        typesIndexMap[type.name] = index;
      });

      // Object and any should always be ordered last
      typesIndexMap['Object'] = types.length;
      typesIndexMap['any'] = types.length + 1;

      return typesIndexMap;
    }

    /**
     *
     * @param {Param} param
     * @param {Object} typesIndexMap
     * @return {number}
     */
    function getLowestTypeIndex (param, typesIndexMap) {
      var min = typesIndexMap[param[0]];

      for (var i = 1; i < param.length; i++) {
        min = Math.min(min, typesIndexMap[param[i]]);
      }

      return min;
    }

    /**
     * Compare two params
     * @param {Param} param1
     * @param {Param} param2
     * @param {Object} typesIndexMap
     * @return {number} returns a negative number when param1 must get a lower
     *                  index than param2, a positive number when the opposite,
     *                  or zero when both are equal
     */
    function compareParams (param1, param2, typesIndexMap) {
      return getLowestTypeIndex(param1, typesIndexMap) - getLowestTypeIndex(param2, typesIndexMap);
    }

    /**
     * Compare two signatures
     * @param {Signature} signature1
     * @param {Signature} signature2
     * @param {Object} typesIndexMap
     * @return {number} returns a negative number when param1 must get a lower
     *                  index than param2, a positive number when the opposite,
     *                  or zero when both are equal
     */
    function compareSignatures (signature1, signature2, typesIndexMap) {
      var len = Math.min(signature1.params.length, signature2.params.length);

      // compare having a rest operator
      var rest = (signature1.restParam - signature2.restParam) // coerce boolean to number
      if (rest !== 0) {
        return rest;
      }

      // compare the params one by one
      for (var i = 0; i < len; i++) {
        var c = compareParams(signature1.params[i], signature2.params[i], typesIndexMap);
        if (c !== 0) {
          return c;
        }
      }

      // compare the number of params
      return signature1.params.length - signature2.params.length;
    }

    /**
     * Create a preprocessing function which picks puts the rest parameters
     * in a single array.
     *
     * @param {Signature} signature
     * @return {function (Array) : Array}
     */
    function createRestParamPreProcess (signature) {
      var offset = signature.params.length - 1;
      return function (args) {
        return slice(args, 0, offset).concat([slice(args, offset)])
      }
    }

    /**
     * Create a typed function
     * @param {String} name               The name for the typed function
     * @param {Object.<string, function>} signatures
     *                                    An object with one or
     *                                    multiple signatures as key, and the
     *                                    function corresponding to the
     *                                    signature as value.
     * @return {function}  Returns the created typed function.
     */
    function createTypedFunction(name, signatures) {
      if (Object.keys(signatures).length === 0) {
        throw new SyntaxError('No signatures provided');
      }

      // parse the signatures
      var defs = [];
      for (var signature in signatures) {
        // noinspection JSUnfilteredForInLoop
        if (hasOwnProperty(signatures, signature)) {
          // noinspection JSUnfilteredForInLoop
          var parsedSignature = filterIgnoredTypes(parseParams(signature));

          if (parsedSignature) {
            // noinspection JSUnfilteredForInLoop
            defs.push({
              signature: parsedSignature,
              restParam: parsedSignature.restParam,
              preprocess: parsedSignature.restParam
                  ? createRestParamPreProcess(parsedSignature)
                  : null,
              test: compileParams(parsedSignature),
              fn: signatures[signature]
            });
          }
        }
      }

      // sort signatures by the order of types
      var typesIndexMap = createTypesIndexMap(typed.types);
      defs.sort(function (a, b) {
        return compareSignatures(a.signature, b.signature, typesIndexMap);
      });

      // create the typed function
      var fn = function () {
        for (var i = 0; i < defs.length; i++) {
          if (defs[i].test(arguments)) {
            if (defs[i].restParam) {
              return defs[i].fn.apply(null, defs[i].preprocess(arguments));
            }
            else {
              return defs[i].fn.apply(null, arguments);
            }
          }
        }

        throw createError(name, arguments);
      }

      // attach name and signatures to the typed function
      Object.defineProperty(fn, 'name', {value: name});
      fn.signatures = {}
      defs.forEach(function (def) {
        fn.signatures[stringifyParams(def.signature)] = def.fn;
      });

      return fn;
    }

    // Test whether a type should be NOT be ignored
    function notIgnore(type) {
      return typed.ignore.indexOf(type) === -1;
    }

    // secure version of object.hasOwnProperty
    function hasOwnProperty(object, prop) {
      return Object.hasOwnProperty.call(object, prop);
    }

    // trim a string
    function trim(str) {
      return str.trim();
    }

    // test whether a string is undefined or empty
    function notEmpty(str) {
      return !!str;
    }

    // return all but the last items of an array
    function initial(arr) {
      return arr.splice(0, arr.length - 1);
    }

    // return the last item of an array
    function last(arr) {
      return arr[arr.length - 1];
    }

    function slice(arr, start, end) {
      return Array.prototype.slice.call(arr, start, end);
    }

    /**
     * Find the first typed function in a set of signatures, and return the
     * name of this function
     * @param {Object<string, function>} signatures
     * @return {string | null}  Returns the name of the first typed function
     *                          Returns null if not found
     */
    function findTypedFunctionName(signatures) {
      for (var signature in signatures) {
        // noinspection JSUnfilteredForInLoop
        if (hasOwnProperty(signatures, signature)) {
          // noinspection JSUnfilteredForInLoop
          if (signatures[signature].signatures) { // test whether a typed-function
            // noinspection JSUnfilteredForInLoop
            return signatures[signature].name; // copy the first name of a typed function
          }
        }
      }
      return null;
    }

    typed = createTypedFunction('typed', {
      'string, Object': createTypedFunction,
      'Object': function (signatures) {
        // find existing name
        var name = findTypedFunctionName(signatures) || '';
        return createTypedFunction(name, signatures);
      }
    });

    typed.create = create;
    typed.types = _types;
    typed.conversions = _conversions;
    typed.ignore = _ignore;

    // add a type
    typed.addType = function (type) {
      if (!type || typeof type.name !== 'string' || typeof type.test !== 'function') {
        throw new TypeError('Object with properties {name: string, test: function} expected');
      }

      typed.types.push(type);
    };

    // add a conversion
    typed.addConversion = function (conversion) {
      if (!conversion
          || typeof conversion.from !== 'string'
          || typeof conversion.to !== 'string'
          || typeof conversion.convert !== 'function') {
        throw new TypeError('Object with properties {from: string, to: string, convert: function} expected');
      }

      typed.conversions.push(conversion);
    };

    return typed;
  }

  return create();
}));
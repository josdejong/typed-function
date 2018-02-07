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

  function notOk (x) {
    return false;
  }

  function undef () {
    return undefined;
  }

  /**
   * @typedef {{
   *   params: Param[],
   *   convertableParams?: Param[],
   *   restParam: boolean
   * }} Signature
   *
   * @typedef {string[]} Param
   *
   * @typedef {{
   *   from: string,
   *   to: string,
   *   convert: function (*) : boolean
   * }} Conversion
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

    // TODO: comment
    function findType (value) {
      var entry = typed.types.find(function (entry) {
        return entry.test(value);
      });

      if (entry) {
        return entry.name;
      }

      throw new TypeError('Value has unknown type. Value: ' + value);
    }

    /**
     * Convert a given value to another data type.
     * @param {*} value
     * @param {string} type
     */
    function convert (value, type) {
      var from = findType(value);

      // check conversion is needed
      if (type === from) {
        return value;
      }

      for (var i = 0; i < typed.conversions.length; i++) {
        var conversion = typed.conversions[i];
        if (conversion.from === from && conversion.to === type) {
          return conversion.convert(value);
        }
      }

      throw new Error('Cannot convert from ' + from + ' to ' + type);
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

        params.push(parseParam(rest ? (param.length > 3) ? param.slice(3) : 'any' : param));
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
      if (!param || param.length === 0) {
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
     * Get params containing all types that can be converted to the
     * defined types.
     *
     * @param {Param[]} params
     * @return {Conversion[][] | null} Returns the conversions that are available
     *                               For every parameter if any,
     *                               returns null if there are no conversions.
     */
    function getConversions (params) {
      var paramConversions = params.map(function (param) {
        var conversions = {};

        typed.conversions.forEach(function (conversion) {
          if (param.indexOf(conversion.to) !== -1 && !conversions[conversion.to]) {
            // console.log('MATCH', param, conversion.from, '->', conversion.to)
            conversions[conversion.from] = conversion;
          }
        });

        return Object.keys(conversions).map(function (from) {
          return conversions[from];
        });
      });

      var hasConvertableParams = paramConversions.some(function (param) {
        return param.length > 0
      });

      return hasConvertableParams ? paramConversions : null;
    }

    /**
     * Extend the parameters of a signature with convertableParams
     * @param {Signature} signature
     * @param {Conversion[][]} conversions
     * @return {Signature} Returns a copy of the signature with added params
     */
    function addConvertableParams(signature, conversions) {
      return {
        params: signature.params.map(function (param, i) {
          var froms = conversions[i].map(function (conversion) {
            return conversion.from;
          })

          return param.concat(froms)
        }),
        restParam: signature.restParam
      };
    }

    // TODO: comment
    /**
     *
     * @param {function} fn
     * @param {Conversion[][]} conversions
     * @param {boolean} restParam
     * @return {function}
     */
    function compileArgsConversion(fn, conversions, restParam) {
      var conv = conversions.map(compileArgConversion)

      return function convertArgs() {
        var args = [];
        var last = restParam ? arguments.length - 1 : arguments.length;
        for (var i = 0; i < last; i++) {
          args[i] = conv[i](arguments[i]);
        }
        if (restParam) {
          args[last] = arguments[last].map(conv[last]);
        }

        return fn.apply(null, args);
      }
    }

    // TODO: comment
    /**
     *
     * @param {Conversion[]} conversions
     * @return {function}
     */
    function compileArgConversion(conversions) {
      var converts = [];
      var tests = [];
      conversions.forEach(function (conversion) {
        tests.push(findTest(conversion.from));
        converts.push(conversion.convert);
      });

      // TODO: make optimized versions for 1 and 2 arguments

      return function convertArg(arg) {
        for (var i = 0; i < converts.length; i++) {
          if (tests[i](arg)) {
            return converts[i](arg);
          }
        }
        return arg;
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
              conversion: false,
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

      // add signatures with conversions
      var count = defs.length;
      for (var i = 0; i < count; i++) {
        var conversions = getConversions(defs[i].signature.params);
        if (conversions) {
          var signature = addConvertableParams(defs[i].signature, conversions);
          // console.log('SIGNATURE', signature)
          defs.push({
            signature: signature,
            restParam: defs[i].restParam,
            conversion: true,
            preprocess: defs[i].preprocess,
            test: compileParams(signature),
            fn: compileArgsConversion(defs[i].fn, conversions, defs[i].restParam)
          });
        }
      }

      // we create a highly optimized checks for the first couple of signatures with max 2 arguments
      var ok0 = defs[0] && defs[0].signature.params.length <= 2 && !defs[0].signature.restParam;
      var ok1 = defs[1] && defs[1].signature.params.length <= 2 && !defs[1].signature.restParam;
      var ok2 = defs[2] && defs[2].signature.params.length <= 2 && !defs[2].signature.restParam;
      var ok3 = defs[3] && defs[3].signature.params.length <= 2 && !defs[3].signature.restParam;
      var ok4 = defs[4] && defs[4].signature.params.length <= 2 && !defs[4].signature.restParam;
      var ok5 = defs[5] && defs[5].signature.params.length <= 2 && !defs[5].signature.restParam;

      var test00 = ok0 ? compileParam(defs[0].signature.params[0]) : notOk;
      var test10 = ok1 ? compileParam(defs[1].signature.params[0]) : notOk;
      var test20 = ok2 ? compileParam(defs[2].signature.params[0]) : notOk;
      var test30 = ok3 ? compileParam(defs[3].signature.params[0]) : notOk;
      var test40 = ok4 ? compileParam(defs[4].signature.params[0]) : notOk;
      var test50 = ok5 ? compileParam(defs[5].signature.params[0]) : notOk;

      var test01 = ok0 ? compileParam(defs[0].signature.params[1]) : notOk;
      var test11 = ok1 ? compileParam(defs[1].signature.params[1]) : notOk;
      var test21 = ok2 ? compileParam(defs[2].signature.params[1]) : notOk;
      var test31 = ok3 ? compileParam(defs[3].signature.params[1]) : notOk;
      var test41 = ok4 ? compileParam(defs[4].signature.params[1]) : notOk;
      var test51 = ok5 ? compileParam(defs[5].signature.params[1]) : notOk;

      var fn0 = ok0 ? defs[0].fn : undef;
      var fn1 = ok1 ? defs[1].fn : undef;
      var fn2 = ok2 ? defs[2].fn : undef;
      var fn3 = ok3 ? defs[3].fn : undef;
      var fn4 = ok4 ? defs[4].fn : undef;
      var fn5 = ok5 ? defs[5].fn : undef;

      var len0 = ok0 ? defs[0].signature.params.length : -1;
      var len1 = ok1 ? defs[1].signature.params.length : -1;
      var len2 = ok2 ? defs[2].signature.params.length : -1;
      var len3 = ok3 ? defs[3].signature.params.length : -1;
      var len4 = ok4 ? defs[4].signature.params.length : -1;
      var len5 = ok5 ? defs[5].signature.params.length : -1;

      // simple and generic, but also slow
      var generic = function generic() {
        'use strict';

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

      // create the typed function
      // fast, specialized version. Falls back to the slower, generic one if needed
      var fn = function fn(arg0, arg1) {
        'use strict';

        if (arguments.length === len0 && test00(arg0) && test01(arg1)) { return fn0.apply(null, arguments); }
        if (arguments.length === len1 && test10(arg0) && test11(arg1)) { return fn1.apply(null, arguments); }
        if (arguments.length === len2 && test20(arg0) && test21(arg1)) { return fn2.apply(null, arguments); }
        if (arguments.length === len3 && test30(arg0) && test31(arg1)) { return fn3.apply(null, arguments); }
        if (arguments.length === len4 && test40(arg0) && test41(arg1)) { return fn4.apply(null, arguments); }
        if (arguments.length === len5 && test50(arg0) && test51(arg1)) { return fn5.apply(null, arguments); }

        return generic.apply(null, arguments);
      }

      // attach name and signatures to the typed function
      Object.defineProperty(fn, 'name', {value: name});
      fn.signatures = {}
      defs.forEach(function (def) {
        if (!def.conversion) {
          // FIXME: split the signatures per individual type, split union types
          fn.signatures[stringifyParams(def.signature)] = def.fn;
        }
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
      return arr.slice(0, arr.length - 1);
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
    typed.convert = convert;

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
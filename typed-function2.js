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

  console.log('loading typed-function2...'); // TODO: cleanup at the end (used in mathjs to know for sure what is loaded)

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
   *   fn: function
   * }} Signature
   *
   * @typedef {{
   *   types: Type[],
   *   restParam: boolean
   * }} Param
   *
   * @typedef {{
   *   name: string,
   *   typeIndex: number,
   *   test: function,
   *   conversion?: ConversionDef,
   *   conversionIndex: number,
   * }} Type
   *
   * @typedef {{
   *   from: string,
   *   to: string,
   *   convert: function (*) : *
   * }} ConversionDef
   *
   * @typedef {{
   *   name: string,
   *   test: function(*) : boolean
   * }} TypeDef
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
     * @param {String} typeName
     * @return {TypeDef} Returns the type definition when found,
     *                    Throws a TypeError otherwise
     */
    function findTypeByName (typeName) {
      var entry = typed.types.find(function (entry) {
        return entry.name === typeName;
      });

      if (entry) {
        return entry;
      }

      var hint = typed.types.find(function (entry) {
        return entry.name.toLowerCase() === typeName.toLowerCase();
      });

      throw new TypeError('Unknown type "' + typeName + '"' +
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
     * Find a specific signature from a (composed) typed function, for
     * example:
     *
     *   typed.find(fn, ['number', 'string'])
     *   typed.find(fn, 'number, string')
     *
     * Function find only only works for exact matches.
     *
     * @param {Function} fn                   A typed-function
     * @param {string | string[]} signature   Signature to be found, can be
     *                                        an array or a comma separated string.
     * @return {Function}                     Returns the matching signature, or
     *                                        throws an error when no signature
     *                                        is found.
     */
    function find (fn, signature) {
      if (!fn.signatures) {
        throw new TypeError('Function is no typed-function');
      }

      // normalize input
      var arr;
      if (typeof signature === 'string') {
        arr = signature.split(',');
        for (var i = 0; i < arr.length; i++) {
          arr[i] = arr[i].trim();
        }
      }
      else if (Array.isArray(signature)) {
        arr = signature;
      }
      else {
        throw new TypeError('String array or a comma separated string expected');
      }

      var str = arr.join(',');

      // find an exact match
      var match = fn.signatures[str];
      if (match) {
        return match;
      }

      // TODO: extend find to match non-exact signatures

      throw new TypeError('Signature not found (signature: ' + (fn.name || 'unnamed') + '(' + arr.join(', ') + '))');
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
     * Stringify parameters in a normalized way
     * @param {Param[]} params
     * @return {string}
     */
    function stringifyParams (params) {
      return params
          .map(function (param) {
            var typeNames = param.types.map(getTypeName);

            return (param.restParam ? '...' : '') + typeNames.join('|');
          })
          .join(',');
    }

    /**
     * Parse a parameter, like "...number | boolean"
     * @param {string} param
     * @param {ConversionDef[]} conversions
     * @return {Param} param
     */
    function parseParam (param, conversions) { // TODO: pass types as an argument too
      var restParam = param.indexOf('...') === 0;
      var types = (!restParam)
          ? param
          : (param.length > 3)
              ? param.slice(3)
              : 'any';

      var typeNames = types.split('|').map(trim)
          .filter(notEmpty)
          .filter(notIgnore);

      var matchingConversions = filterConversions(conversions, typeNames);

      var exactTypes = typeNames.map(function (typeName) {
        var type = findTypeByName(typeName);

        return {
          name: typeName,
          typeIndex: typed.types.indexOf(type),
          test: type.test,
          conversion: null,
          conversionIndex: -1
        };
      });

      var convertableTypes = matchingConversions.map(function (conversion) {
        var type = findTypeByName(conversion.from);

        return {
          name: conversion.from,
          typeIndex: typed.types.indexOf(type),
          test: type.test,
          conversion: conversion,
          conversionIndex: conversions.indexOf(conversion)
        };
      });

      return {
        types: exactTypes.concat(convertableTypes),
        restParam: restParam
      };
    }

    /**
     * Parse a signature with comma separated parameters,
     * like "number | boolean, ...string"
     * @param {string} signature
     * @param {function} fn
     * @param {ConversionDef[]} conversions
     * @return {Signature | null} signature
     */
    function parseSignature (signature, fn, conversions) {
      var params = [];

      if (signature.trim() !== '') {
        params = signature
            .split(',')
            .map(trim)
            .map(function (param, index, array) {
              var parsedParam = parseParam(param, conversions);

              if (parsedParam.restParam && (index !== array.length - 1)) {
                throw new SyntaxError('Unexpected rest parameter "' + param + '": ' +
                    'only allowed for the last parameter');
              }

              return parsedParam;
          });
      }

      if (params.some(isInvalidParam)) {
        // invalid signature: at least one parameter has no types
        // (they may have been filtered)
        return null;
      }

      return {
        params: params,
        fn: fn
      };
    }

    /**
     * Test whether a set of params contains a restParam
     * @param {Param[]} params
     * @return {boolean} Returns true when the last parameter is a restParam
     */
    function hasRestParam(params) {
      var param = last(params)
      return param ? param.restParam : false;
    }

    /**
     * Test whether a parameter contains conversions
     * @param {Param} param
     * @return {boolean} Returns true when at least one of the parameters
     *                   contains a conversion.
     */
    function hasConversions(param) {
      return param.types.some(function (type) {
        return type.conversion != null;
      });
    }

    /**
     * Create a type test for a single parameter, which can have one or multiple
     * types.
     * @param {Param} param
     * @return {function(x: *) : boolean} Returns a test function
     */
    function compileTest(param) {
      if (!param || param.types.length === 0) {
        // nothing to do
        return ok;
      }
      else if (param.types.length === 1) {
        return findTypeByName(param.types[0].name).test;
      }
      else if (param.types.length === 2) {
        var test0 = findTypeByName(param.types[0].name).test;
        var test1 = findTypeByName(param.types[1].name).test;
        return function or(x) {
          return test0(x) || test1(x);
        }
      }
      else { // param.types.length > 2
        var tests = param.types.map(function (type) {
          return findTypeByName(type.name).test;
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
     * @param {Param[]} params
     * @return {function(args: Array<*>) : boolean}
     */
    function compileTests(params) {
      var tests, test0, test1;

      if (hasRestParam(params)) { // variable arguments like '...number'
        tests = initial(params).map(compileTest);
        var varIndex = tests.length;
        var lastTest = compileTest(last(params));
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
        if (params.length === 0) {
          return function testArgs(args) {
            return args.length === 0;
          };
        }
        else if (params.length === 1) {
          test0 = compileTest(params[0]);
          return function testArgs(args) {
            return test0(args[0]) && args.length === 1;
          };
        }
        else if (params.length === 2) {
          test0 = compileTest(params[0]);
          test1 = compileTest(params[1]);
          return function testArgs(args) {
            return test0(args[0]) && test1(args[1]) && args.length === 2;
          };
        }
        else { // arguments.length > 2
          tests = params.map(compileTest);
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

    // TODO: comment
    function getExpectedTypeNames (signature, index) {
      return index < signature.params.length
          ? signature.params[index].types.map(getTypeName)
          : hasRestParam(signature.params)
              ? last(signature.params).types.map(getTypeName)
              : []
    }

    /**
     * Returns the name of a type
     * @param {Type} type
     * @return {string} Returns the type name
     */
    function getTypeName(type) {
      return type.name;
    }

    // TODO: comment
    function isExactType(type) {
      return type.conversion === null || type.conversion === undefined;
    }

    // TODO: comment
    function isCorrectType(expectedParam, actualType) {
      return (expectedParam &&
             (expectedParam.indexOf(actualType) !== -1 ||
              expectedParam.indexOf('any') !== -1))
    }

    /**
     * Helper function for creating error messages: create an array with
     * all available types on a specific argument index.
     * @param {Signature[]} signatures
     * @param {number} index
     * @return {string[]} Returns an array with available types
     */
    function mergeExpectedParams(signatures, index) {
      var typeNames = uniq(flatMap(signatures, function (def) {
        return getExpectedTypeNames(def, index);
      }));

      return (typeNames.indexOf('any') !== -1) ? ['any'] : typeNames;
    }

    // TODO: comment
    function createError(name, args, signatures) {
      var err, expected;
      var _name = name || 'unnamed';

      // find the actual types
      var actualTypes = Array.prototype.map.call(args, function (arg) {
        var entry = typed.types.find(function (entry) {
          return entry.test(arg);
        });
        return entry ? entry.name : 'unknown';
      });

      // test for wrong type
      var matchingSignatures = signatures;
      var index;
      for (index = 0; index < actualTypes.length; index++) {
        var actualType = actualTypes[index];

        var nextMatchingDefs = matchingSignatures.filter(function (def) {
          return isCorrectType(getExpectedTypeNames(def, index), actualType)
        });

        if (nextMatchingDefs.length === 0) {
          // no matching signatures anymore, throw error "wrong type"
          expected = mergeExpectedParams(matchingSignatures, index);
          if (expected.length > 0) {
            err = new TypeError('Unexpected type of argument in function ' + _name +
                ' (expected: ' + expected.join(' or ') +
                ', actual: ' + actualType + ', index: ' + index + ')');
            err.data = {
              category: 'wrongType',
              fn: _name,
              index: index,
              actual: actualType,
              expected: expected
            }
            return err;
          }
        }
        else {
          matchingSignatures = nextMatchingDefs;
        }
      }

      // test for too few arguments
      var lengths = matchingSignatures.map(function (def) {
        return hasRestParam(def.params) ? Infinity : def.params.length;
      });
      if (actualTypes.length < Math.min.apply(null, lengths)) {
        expected = mergeExpectedParams(matchingSignatures, index);
        err = new TypeError('Too few arguments in function ' + _name +
            ' (expected: ' + expected.join(' or ') +
            ', index: ' + actualTypes.length + ')');
        err.data = {
          category: 'tooFewArgs',
          fn: _name,
          index: actualTypes.length,
          expected: expected
        }
        return err;
      }

      // test for too many arguments
      var maxLength = Math.max.apply(null, lengths);
      if (actualTypes.length > maxLength) {
        err = new TypeError('Too many arguments in function ' + _name +
            ' (expected: ' + maxLength + ', actual: ' + actualTypes.length + ')');
        err.data = {
          category: 'tooManyArgs',
          fn: _name,
          index: actualTypes.length,
          expectedLength: maxLength
        }
        return err;
      }

      err = new TypeError('Arguments of type "' + actualTypes.join(', ') +
          '" do not match any of the defined signatures of function ' + _name + '.');
      err.data = {
        category: 'mismatch',
        actual: actualTypes
      }
      return err;
    }

    /**
     * Create a map with the name of a type as key and the index as value.
     * Used for sorting
     * @param {Array} types
     * @return {Object}
     */
    function createTypesIndexMap (types) {  // TODO: cleanup. But first fix the ordering of object and any
      var typesIndexMap = {};

      types.forEach(function (type, index) {
        if (type.name in typesIndexMap) {
          throw new TypeError('Type "' + type.name + '" is defined twice. ' +
              'Check the definitions in typed.types');
        }

        typesIndexMap[type.name] = index;
      });

      // Object and any should always be ordered last
      typesIndexMap['Object'] = types.length;
      typesIndexMap['any'] = types.length + 1;

      return typesIndexMap;
    }

    /**
     * TODO: comment
     * @param {Param} param
     * @return {number}
     */
    function getLowestTypeIndex (param) {
      var exactTypes = param.types.filter(isExactType);
      var min = 999999;

      for (var i = 0; i < exactTypes.length; i++) {
        if (!exactTypes[i].conversion) {
          min = Math.min(min, exactTypes[i].typeIndex);
        }
      }

      return min;
    }

    /**
     * TODO: comment
     * @param {Param} param
     * @return {number}
     */
    function getLowestConversionIndex (param) {
      var filteredTypes = param.types.filter(function (type) {
        return type.conversion !== null;
      })
      var min = 999999;

      for (var i = 0; i < filteredTypes.length; i++) {
        if (filteredTypes[i].conversion) {
          min = Math.min(min, filteredTypes[i].conversionIndex);
        }
      }

      return min;
    }

    /**
     * Compare two params
     * @param {Param} param1
     * @param {Param} param2
     * @return {number} returns a negative number when param1 must get a lower
     *                  index than param2, a positive number when the opposite,
     *                  or zero when both are equal
     */
    function compareParams (param1, param2) {
      var typeIndexDiff = getLowestTypeIndex(param1) - getLowestTypeIndex(param2);
      if (typeIndexDiff !== 0) {
        return typeIndexDiff;
      }

      return getLowestConversionIndex(param1) - getLowestConversionIndex(param2);
    }

    /**
     * Compare two signatures
     * @param {Signature} signature1
     * @param {Signature} signature2
     * @return {number} returns a negative number when param1 must get a lower
     *                  index than param2, a positive number when the opposite,
     *                  or zero when both are equal
     */
    function compareSignatures (signature1, signature2) {
      // compare having a rest operator (we coerce booleans to numbers here)
      var restParam = (hasRestParam(signature1.params) - hasRestParam(signature2.params));
      if (restParam !== 0) {
        return restParam;
      }

      // compare the params one by one
      var len = Math.min(signature1.params.length, signature2.params.length);
      for (var i = 0; i < len; i++) {
        var c = compareParams(signature1.params[i], signature2.params[i]);
        if (c !== 0) {
          return c;
        }
      }

      // compare the number of params
      return signature1.params.length - signature2.params.length;
    }

    /**
     * Get params containing all types that can be converted to the defined types.
     *
     * @param {ConversionDef[]} conversions
     * @param {string[]} typeNames
     * @return {ConversionDef[]} Returns the conversions that are available
     *                        for every type (if any)
     */
    function filterConversions (conversions, typeNames) {
      var matches = {};

      conversions.forEach(function (conversion) {
        if (typeNames.indexOf(conversion.from) === -1 &&
            typeNames.indexOf(conversion.to) !== -1 &&
            !matches[conversion.from]) {
          // console.log('MATCH', param, conversion.from, '->', conversion.to)
          matches[conversion.from] = conversion;
        }
      });

      return Object.keys(matches).map(function (from) {
        return matches[from];
      });
    }

    /**
     * Preprocess arguments before calling the original function:
     * - if needed convert the parameters
     * - in case of rest parameters, move the rest parameters into an Array
     * @param {Param[]} params
     * @param {function} fn
     * @return {function} Returns a wrapped function
     */
    function compileArgsPreprocessing(params, fn) {
      var fnConvert = fn;

      // TODO: can we make this wrapper function smarter/simpler?

      if (params.some(hasConversions)) {
        // console.log('compileArgsPreprocessing...', JSON.stringify(params))
        var restParam = hasRestParam(params);
        var compiledConversions = params.map(compileArgConversion)

        fnConvert = function convertArgs() {
          var args = [];
          var last = restParam ? arguments.length - 1 : arguments.length;
          for (var i = 0; i < last; i++) {
            args[i] = compiledConversions[i](arguments[i]);
          }
          if (restParam) {
            args[last] = arguments[last].map(compiledConversions[last]);
          }

          return fn.apply(null, args);
        }
      }

      var fnPreprocess = fnConvert;
      if (hasRestParam(params)) {
        var offset = params.length - 1;

        fnPreprocess = function preprocessRestParams () {
          return fnConvert.apply(null,
              slice(arguments, 0, offset).concat([slice(arguments, offset)]));
        }
      }

      return fnPreprocess;
    }

    // TODO: comment
    /**
     *
     * @param {Param} param
     * @return {function}
     */
    function compileArgConversion(param) {
      var tests = [];
      var conversions = [];
      param.types.forEach(function (type) {
        if (type.conversion) {
          tests.push(findTypeByName(type.conversion.from).test);
          conversions.push(type.conversion.convert);
        }
      });

      // TODO: make optimized versions for 0, 1 and 2 conversions

      return function convertArg(arg) {
        for (var i = 0; i < conversions.length; i++) {
          if (tests[i](arg)) {
            return conversions[i](arg);
          }
        }
        return arg;
      }
    }

    /**
     * Convert an array with signatures into a map with signatures,
     * where signatures with union types are split into separate signatures
     *
     * Throws an error when there are conflicting types
     *
     * @param {Signature[]} signatures
     * @return {Object.<string, function>}  Returns a map with signatures
     *                                      as key and the original function
     *                                      of this signature as value.
     */
    function createSignaturesMap(signatures) {
      var signaturesMap = {};
      signatures.forEach(function (signature) {
        if (!signature.params.some(hasConversions)) {
          splitParams(signature.params, true).forEach(function (params) {
            signaturesMap[stringifyParams(params)] = signature.fn;
          });
        }
      });

      return signaturesMap;
    }

    /**
     * Split params with union types in to separate params.
     *
     * For example:
     *
     *     splitParams([['Array', 'Object'], ['string', 'RegExp'])
     *     // returns:
     *     // [
     *     //   ['Array', 'string'],
     *     //   ['Array', 'RegExp'],
     *     //   ['Object', 'string'],
     *     //   ['Object', 'RegExp']
     *     // ]
     *
     * @param {Param[]} params
     * @param {boolean} ignoreConversionTypes
     * @return {Param[]}
     */
    function splitParams(params, ignoreConversionTypes) {
      // TODO: remove the option ignoreConversionTypes ?
      function _splitParams(params, index, types) {
        if (index < params.length) {
          var param = params[index]
          var filteredTypes = ignoreConversionTypes
              ? param.types.filter(isExactType)
              : param.types;

          if (param.restParam) {
            // do not split the types of a rest parameter
            return _splitParams(params, index + 1, types.concat([filteredTypes]));
          }
          else {
            // split the types of a regular parameter, recurse over the params
            return flatMap(filteredTypes, function (type) {
              return _splitParams(params, index + 1, types.concat([[type]]));
            });
          }
        }
        else {
          // we've reached the end of the parameters. Now build a new Param
          var splittedParams = types.map(function (type, typeIndex) {
            return {
              types: type,
              restParam: (typeIndex === params.length - 1) && hasRestParam(params)
            }
          });

          return [splittedParams];
        }
      }

      return _splitParams(params, 0, []);
    }

    /**
     * Create a typed function
     * @param {String} name               The name for the typed function
     * @param {Object.<string, function>} signaturesMap
     *                                    An object with one or
     *                                    multiple signatures as key, and the
     *                                    function corresponding to the
     *                                    signature as value.
     * @return {function}  Returns the created typed function.
     */
    function createTypedFunction(name, signaturesMap) {
      if (Object.keys(signaturesMap).length === 0) {
        throw new SyntaxError('No signatures provided');
      }

      // parse the signatures
      var signatures = flatMap(Object.keys(signaturesMap), function (signature) {
        var parsedSignature = parseSignature(signature, signaturesMap[signature], typed.conversions)
        var params = parsedSignature ? splitParams(parsedSignature.params, false) : []

        return params.map(function (params) {
          return {
            params: params,
            fn: parsedSignature.fn
          };
        });
      }).filter(notNull);

      signatures.sort(compareSignatures);

      // TODO: cleanup, or put behind a "debug" flag
      // console.log()
      // console.log('---- after sort ----')
      // signatures.map(stringifySignature).forEach(function (str) {console.log(str)})

      // we create a highly optimized checks for the first couple of signatures with max 2 arguments
      var ok0 = signatures[0] && signatures[0].params.length <= 2 && !hasRestParam(signatures[0].params);
      var ok1 = signatures[1] && signatures[1].params.length <= 2 && !hasRestParam(signatures[1].params);
      var ok2 = signatures[2] && signatures[2].params.length <= 2 && !hasRestParam(signatures[2].params);
      var ok3 = signatures[3] && signatures[3].params.length <= 2 && !hasRestParam(signatures[3].params);
      var ok4 = signatures[4] && signatures[4].params.length <= 2 && !hasRestParam(signatures[4].params);
      var ok5 = signatures[5] && signatures[5].params.length <= 2 && !hasRestParam(signatures[5].params);
      var allOk = ok0 && ok1 && ok2 && ok3 && ok4 && ok5;

      // compile the tests
      var tests = signatures.map(function (signature) {
        return compileTests(signature.params);
      });

      var test00 = ok0 ? compileTest(signatures[0].params[0]) : notOk;
      var test10 = ok1 ? compileTest(signatures[1].params[0]) : notOk;
      var test20 = ok2 ? compileTest(signatures[2].params[0]) : notOk;
      var test30 = ok3 ? compileTest(signatures[3].params[0]) : notOk;
      var test40 = ok4 ? compileTest(signatures[4].params[0]) : notOk;
      var test50 = ok5 ? compileTest(signatures[5].params[0]) : notOk;

      var test01 = ok0 ? compileTest(signatures[0].params[1]) : notOk;
      var test11 = ok1 ? compileTest(signatures[1].params[1]) : notOk;
      var test21 = ok2 ? compileTest(signatures[2].params[1]) : notOk;
      var test31 = ok3 ? compileTest(signatures[3].params[1]) : notOk;
      var test41 = ok4 ? compileTest(signatures[4].params[1]) : notOk;
      var test51 = ok5 ? compileTest(signatures[5].params[1]) : notOk;

      // compile the functions
      var fns = signatures.map(function(signature) {
        return compileArgsPreprocessing(signature.params, signature.fn)
      });

      var fn0 = ok0 ? fns[0] : undef;
      var fn1 = ok1 ? fns[1] : undef;
      var fn2 = ok2 ? fns[2] : undef;
      var fn3 = ok3 ? fns[3] : undef;
      var fn4 = ok4 ? fns[4] : undef;
      var fn5 = ok5 ? fns[5] : undef;

      var len0 = ok0 ? signatures[0].params.length : -1;
      var len1 = ok1 ? signatures[1].params.length : -1;
      var len2 = ok2 ? signatures[2].params.length : -1;
      var len3 = ok3 ? signatures[3].params.length : -1;
      var len4 = ok4 ? signatures[4].params.length : -1;
      var len5 = ok5 ? signatures[5].params.length : -1;

      // simple and generic, but also slow
      var iStart = allOk ? 6 : 0;
      var iEnd = signatures.length;
      var generic = function generic() {
        'use strict';

        for (var i = iStart; i < iEnd; i++) {
          if (tests[i](arguments)) {
            return fns[i].apply(null, arguments);
          }
        }

        throw createError(name, arguments, signatures);
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
      fn.signatures = createSignaturesMap(signatures);

      return fn;
    }

    /**
     * Stringify a signature for debugging purposes
     * @param {Signature} signature
     * @return {string}
     */
    // TODO: use or cleanup
    function stringifySignature (signature) {
      return signature.params
          .map(function (param) {
            var typeNames = param.types.map(function (type) {
              return type.conversion
                  ? ('c(' + type.conversion.from + ' -> ' + type.conversion.to + ')')
                  : type.name
            });

            return (param.restParam ? '...' : '') + typeNames.join(' | ');
          })
          .join(', ');
    }

    // Test whether a type should be NOT be ignored
    function notIgnore(type) {
      return typed.ignore.indexOf(type) === -1;
    }

    // trim a string
    function trim(str) {
      return str.trim();
    }

    // test whether a string is undefined or empty
    function notEmpty(str) {
      return !!str;
    }

    // test whether a value is strict equal to null
    function notNull(value ) {
      return value !== null;
    }

    /**
     * Test whether a parameter has no types defined
     * @param {Param} param
     * @return {boolean}
     */
    function isInvalidParam (param) {
      return param.types.length === 0;
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

    function uniq(arr) {
      var entries = {}
      for (var i = 0; i < arr.length; i++) {
        entries[arr[i]] = true;
      }
      return Object.keys(entries);
    }

    // https://gist.github.com/samgiles/762ee337dff48623e729
    function flatMap(arr, callback) {
      return Array.prototype.concat.apply([], arr.map(callback));
    }

    /**
     * Retrieve the function name from a set of typed functions,
     * and check whether the name of all functions match (if given)
     * @param {function[]} fns
     */
    function getName (fns) {
      var name = '';

      for (var i = 0; i < fns.length; i++) {
        var fn = fns[i];

        // check whether the names are the same when defined
        if (fn.signatures && fn.name !== '') {
          if (name === '') {
            name = fn.name;
          }
          else if (name !== fn.name) {
            var err = new Error('Function names do not match (expected: ' + name + ', actual: ' + fn.name + ')');
            err.data = {
              actual: fn.name,
              expected: name
            };
            throw err;
          }
        }
      }

      return name;
    }

    typed = createTypedFunction('typed', {
      'string, Object': createTypedFunction,
      'Object': function (signaturesMap) {
        // find existing name
        var fns = [];
        for (var signature in signaturesMap) {
          if (signaturesMap.hasOwnProperty(signature)) {
            fns.push(signaturesMap[signature]);
          }
        }
        var name = getName(fns);
        return createTypedFunction(name, signaturesMap);
      },
      '...Function': function (fns) {
        var err;
        var name = getName(fns);
        var signaturesMap = {};

        for (var i = 0; i < fns.length; i++) {
          var fn = fns[i];

          // test whether this is a typed-function
          if (!(typeof fn.signatures === 'object')) {
            err = new TypeError('Function is no typed-function (index: ' + i + ')');
            err.data = {index: i};
            throw err;
          }

          // merge the signatures
          for (var signature in fn.signatures) {
            if (fn.signatures.hasOwnProperty(signature)) {
              if (signaturesMap.hasOwnProperty(signature)) {
                if (fn.signatures[signature] !== signaturesMap[signature]) {
                  err = new Error('Signature "' + signature + '" is defined twice');
                  err.data = {signature: signature};
                  throw err;
                }
                // else: both signatures point to the same function, that's fine
              }
              else {
                signaturesMap[signature] = fn.signatures[signature];
              }
            }
          }
        }

        return createTypedFunction(name, signaturesMap);
      }
    });

    typed.create = create;
    typed.types = _types;
    typed.conversions = _conversions;
    typed.ignore = _ignore;
    typed.convert = convert;
    typed.find = find;

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
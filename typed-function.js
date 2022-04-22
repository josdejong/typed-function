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

  function ok () {
    return true;
  }

  function notOk () {
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
   *   hasAny: boolean,
   *   hasConversion: boolean,
   *   restParam: boolean
   * }} Param
   *
   * @typedef {{
   *   name: string,
   *   typeIndex: number,
   *   test: function,
   *   isAny: boolean,
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

    /**
     * Returns true if the argument is a non-null "plain" object
     */
    function isPlainObject (x) {
      return typeof x === 'object' && x !== null && x.constructor === Object
    }

    var _types = [
      { name: 'number',    test: function (x) { return typeof x === 'number' } },
      { name: 'string',    test: function (x) { return typeof x === 'string' } },
      { name: 'boolean',   test: function (x) { return typeof x === 'boolean' } },
      { name: 'Function',  test: function (x) { return typeof x === 'function'} },
      { name: 'Array',     test: Array.isArray },
      { name: 'Date',      test: function (x) { return x instanceof Date } },
      { name: 'RegExp',    test: function (x) { return x instanceof RegExp } },
      { name: 'Object',    test: isPlainObject },
      { name: 'null',      test: function (x) { return x === null } },
      { name: 'undefined', test: function (x) { return x === undefined } }
    ];

    var anyType = {
      name: 'any',
      test: ok,
      isAny: true
    }

    // types which need to be ignored
    var _ignore = [];

    // type conversions
    var _conversions = [];

    // This is a temporary object, will be replaced with a typed function at the end
    var typed = {
      types: _types,
      conversions: _conversions,
      ignore: _ignore,
      createCount: 0
    };

    /**
     * Find the test function for a type
     * @param {String} typeName
     * @return {TypeDef} Returns the type definition when found,
     *                    Throws a TypeError otherwise
     */
    function findTypeByName (typeName) {
      var entry = findInArray(typed.types, function (entry) {
        return entry.name === typeName;
      });

      if (entry) {
        return entry;
      }

      if (typeName === 'any') { // special baked-in case 'any'
        return anyType;
      }

      var hint = findInArray(typed.types, function (entry) {
        return entry.name.toLowerCase() === typeName.toLowerCase();
      });

      throw new TypeError('Unknown type "' + typeName + '"' +
          (hint ? ('. Did you mean "' + hint.name + '"?') : ''));
    }

    /**
     * Find the index of a type definition. Handles special case 'any'
     * @param {TypeDef} type
     * @return {number}
     */
    function findTypeIndex(type) {
      if (type === anyType) {
        return 999;
      }

      return typed.types.indexOf(type);
    }

    /**
     * Find a type that matches a value.
     * @param {*} value
     * @return {string} Returns the name of the first type for which
     *                  the type test matches the value.
     */
    function findTypeName(value) {
      var entry = findInArray(typed.types, function (entry) {
        return entry.test(value);
      });

      if (entry) {
        return entry.name;
      }

      throw new TypeError('Value has unknown type. Value: ' + value);
    }

    /**
     * Find a specific signature from a (composed) typed function, for example:
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
      var from = findTypeName(value);

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
    function parseParam (param, conversions) {
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

      var hasAny = false

      var exactTypes = typeNames.map(function (typeName) {
        var type = findTypeByName(typeName);
        hasAny = type.isAny || hasAny;

        return {
          name: typeName,
          typeIndex: findTypeIndex(type),
          test: type.test,
          isAny: type.isAny,
          conversion: null,
          conversionIndex: -1
        };
      });

      var convertibleTypes = matchingConversions.map(function (conversion) {
        var type = findTypeByName(conversion.from);
        hasAny = type.isAny || hasAny;

        return {
          name: conversion.from,
          typeIndex: findTypeIndex(type),
          test: type.test,
          isAny: type.isAny,
          conversion: conversion,
          conversionIndex: conversions.indexOf(conversion)
        };
      });

      return {
        types: exactTypes.concat(convertibleTypes),
        hasAny: hasAny,
        hasConversion: convertibleTypes.length > 0,
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

      if (hasRestParam(params)) {
        // variable arguments like '...number'
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
      else {
        // no variable arguments
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

    /**
     * Find the parameter at a specific index of a signature.
     * Handles rest parameters.
     * @param {Signature} signature
     * @param {number} index
     * @return {Param | null} Returns the matching parameter when found,
     *                        null otherwise.
     */
    function getParamAtIndex(signature, index) {
      return index < signature.params.length
          ? signature.params[index]
          : hasRestParam(signature.params)
              ? last(signature.params)
              : null
    }

    /**
     * Get all type names of a parameter
     * @param {Signature} signature
     * @param {number} index
     * @param {boolean} excludeConversions
     * @return {string[]} Returns an array with type names
     */
    function getExpectedTypeNames (signature, index, excludeConversions) {
      var param = getParamAtIndex(signature, index);
      var types = param
          ? excludeConversions
                  ? param.types.filter(isExactType)
                  : param.types
          : [];

      return types.map(getTypeName);
    }

    /**
     * Returns the name of a type
     * @param {Type} type
     * @return {string} Returns the type name
     */
    function getTypeName(type) {
      return type.name;
    }

    /**
     * Test whether a type is an exact type or conversion
     * @param {Type} type
     * @return {boolean} Returns true when
     */
    function isExactType(type) {
      return type.conversion === null || type.conversion === undefined;
    }

    /**
     * Helper function for creating error messages: create an array with
     * all available types on a specific argument index.
     * @param {Signature[]} signatures
     * @param {number} index
     * @return {string[]} Returns an array with available types
     */
    function mergeExpectedParams(signatures, index) {
      var typeNames = uniq(flatMap(signatures, function (signature) {
        return getExpectedTypeNames(signature, index, false);
      }));

      return (typeNames.indexOf('any') !== -1) ? ['any'] : typeNames;
    }

    /**
     * Create
     * @param {string} name             The name of the function
     * @param {array.<*>} args          The actual arguments passed to the function
     * @param {Signature[]} signatures  A list with available signatures
     * @return {TypeError} Returns a type error with additional data
     *                     attached to it in the property `data`
     */
    function createError(name, args, signatures) {
      var err, expected;
      var _name = name || 'unnamed';

      // test for wrong type at some index
      var matchingSignatures = signatures;
      var index;
      for (index = 0; index < args.length; index++) {
        var nextMatchingDefs = matchingSignatures.filter(function (signature) {
          var test = compileTest(getParamAtIndex(signature, index));
          return (index < signature.params.length || hasRestParam(signature.params)) &&
              test(args[index]);
        });

        if (nextMatchingDefs.length === 0) {
          // no matching signatures anymore, throw error "wrong type"
          expected = mergeExpectedParams(matchingSignatures, index);
          if (expected.length > 0) {
            var actualType = findTypeName(args[index]);

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
      var lengths = matchingSignatures.map(function (signature) {
        return hasRestParam(signature.params) ? Infinity : signature.params.length;
      });
      if (args.length < Math.min.apply(null, lengths)) {
        expected = mergeExpectedParams(matchingSignatures, index);
        err = new TypeError('Too few arguments in function ' + _name +
            ' (expected: ' + expected.join(' or ') +
            ', index: ' + args.length + ')');
        err.data = {
          category: 'tooFewArgs',
          fn: _name,
          index: args.length,
          expected: expected
        }
        return err;
      }

      // test for too many arguments
      var maxLength = Math.max.apply(null, lengths);
      if (args.length > maxLength) {
        err = new TypeError('Too many arguments in function ' + _name +
            ' (expected: ' + maxLength + ', actual: ' + args.length + ')');
        err.data = {
          category: 'tooManyArgs',
          fn: _name,
          index: args.length,
          expectedLength: maxLength
        }
        return err;
      }

      err = new TypeError('Arguments of type "' + args.join(', ') +
          '" do not match any of the defined signatures of function ' + _name + '.');
      err.data = {
        category: 'mismatch',
        actual: args.map(findTypeName)
      }
      return err;
    }

    /**
     * Find the lowest index of all exact types of a parameter (no conversions)
     * @param {Param} param
     * @return {number} Returns the index of the lowest type in typed.types
     */
    function getLowestTypeIndex (param) {
      var min = 999;

      for (var i = 0; i < param.types.length; i++) {
        if (isExactType(param.types[i])) {
          min = Math.min(min, param.types[i].typeIndex);
        }
      }

      return min;
    }

    /**
     * Find the lowest index of the conversion of all types of the parameter
     * having a conversion
     * @param {Param} param
     * @return {number} Returns the lowest index of the conversions of this type
     */
    function getLowestConversionIndex (param) {
      var min = 999;

      for (var i = 0; i < param.types.length; i++) {
        if (!isExactType(param.types[i])) {
          min = Math.min(min, param.types[i].conversionIndex);
        }
      }

      return min;
    }

    /**
     * Compare two params
     * @param {Param} param1
     * @param {Param} param2
     * @return {number} returns -1 when param1 must get a lower
     *                  index than param2, 1 when the opposite,
     *                  or zero when both are equal
     */
    function compareParams (param1, param2) {
      // We compare a number of metrics on a param in turn:
      // 1) 'any' parameters are the least preferred
      if (param1.hasAny) {
        if (!param2.hasAny) return 1
      }
      else if (param2.hasAny) return -1

      // 2) Prefer non-rest to rest parameters
      if (param1.restParam) {
        if (!param2.restParam) return 1
      } else if (param2.restParam) return -1

      // 3) Prefer exact type match to conversions
      if (param1.hasConversion) {
        if (!param2.hasConversion) return 1
      } else if (param2.hasConversion) return -1

      // 4) Prefer lower type index:
      const typeDiff = getLowestTypeIndex(param1) - getLowestTypeIndex(param2)
      if (typeDiff < 0) return -1
      if (typeDiff > 0) return 1

      // 5) Prefer lower conversion index
      const convDiff =
        getLowestConversionIndex(param1) - getLowestConversionIndex(param2)
      if (convDiff < 0) return -1
      if (convDiff > 0) return 1

      // Don't have a basis for preference
      return 0
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
      const pars1 = signature1.params
      const pars2 = signature2.params
      const last1 = last(pars1)
      const last2 = last(pars2)
      const hasRest1 = hasRestParam(pars1)
      const hasRest2 = hasRestParam(pars2)
      // We compare a number of metrics on signatures in turn:
      // 1) An "any rest param" is least preferred
      if (hasRest1 && last1.hasAny) {
        if (!hasRest2 || !last2.hasAny) return 1
      } else if (hasRest2 && last2.hasAny) return -1

      // 2) Minimize the number of 'any' parameters
      let any1 = 0;
      let conv1 = 0;
      let par;
      for (par of pars1) {
        if (par.hasAny) ++any1;
        if (par.hasConversion) ++conv1;
      }
      let any2 = 0;
      let conv2 = 0;
      for (par of pars2) {
        if (par.hasAny) ++any2;
        if (par.hasConversion) ++conv2;
      }
      if (any1 !== any2) return any1 - any2;

      // 3) A conversion rest param is less preferred
      if (hasRest1 && last1.hasConversion) {
        if (!hasRest2 || !last2.hasConversion) return 1
      } else if (hasRest2 && last2.hasConversion) return -1

      // 4) Minimize the number of conversions
      if (conv1 !== conv2) return conv1 - conv2;

      // 5) Prefer no rest param
      if (hasRest1) {
        if (!hasRest2) return 1
      } else if (hasRest2) return -1

      // 6) Prefer shorter with rest param, longer without
      const lengthCriterion = (pars1.length - pars2.length) * (hasRest1 ? -1 : 1)
      if (lengthCriterion !== 0) return lengthCriterion

      // Signatures are identical in each of the above metrics.
      // In particular, they are the same length.
      // We can therefore compare the parameters one by one.
      // First we count which signature has more preferred parameters.
      const comparisons = []
      let tc = 0
      for (let i = 0; i < pars1.length; ++i) {
        const thisComparison = compareParams(pars1[i], pars2[i])
        comparisons.push(thisComparison)
        tc += thisComparison
      }
      if (tc !== 0) return tc

      // They have the same number of preferred parameters, so go by the
      // earliest parameter in which we have a preference.
      // In other words, dispatch is driven somewhat more by earlier
      // parameters than later ones.
      let c
      for (c of comparisons) {
        if (c !== 0) return c
      }

      // It's a tossup:
      return 0
    }

    /**
     * Get params containing all types that can be converted to the defined types.
     *
     * @param {ConversionDef[]} conversions
     * @param {string[]} typeNames
     * @return {ConversionDef[]} Returns the conversions that are available
     *                        for every type (if any)
     */
    function filterConversions(conversions, typeNames) {
      var matches = {};

      conversions.forEach(function (conversion) {
        if (typeNames.indexOf(conversion.from) === -1 &&
            typeNames.indexOf(conversion.to) !== -1 &&
            !matches[conversion.from]) {
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

      if (params.some(p => p.hasConversion)) {
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

          return fn.apply(this, args);
        }
      }

      var fnPreprocess = fnConvert;
      if (hasRestParam(params)) {
        var offset = params.length - 1;

        fnPreprocess = function preprocessRestParams () {
          return fnConvert.apply(this,
              slice(arguments, 0, offset).concat([slice(arguments, offset)]));
        }
      }

      return fnPreprocess;
    }

    /**
     * Compile conversion for a parameter to the right type
     * @param {Param} param
     * @return {function} Returns the wrapped function that will convert arguments
     *
     */
    function compileArgConversion(param) {
      var test0, test1, conversion0, conversion1;
      var tests = [];
      var conversions = [];

      param.types.forEach(function (type) {
        if (type.conversion) {
          tests.push(findTypeByName(type.conversion.from).test);
          conversions.push(type.conversion.convert);
        }
      });

      // create optimized conversion functions depending on the number of conversions
      switch (conversions.length) {
        case 0:
          return function convertArg(arg) {
            return arg;
          }

        case 1:
          test0 = tests[0]
          conversion0 = conversions[0];
          return function convertArg(arg) {
            if (test0(arg)) {
              return conversion0(arg)
            }
            return arg;
          }

        case 2:
          test0 = tests[0]
          test1 = tests[1]
          conversion0 = conversions[0];
          conversion1 = conversions[1];
          return function convertArg(arg) {
            if (test0(arg)) {
              return conversion0(arg)
            }
            if (test1(arg)) {
              return conversion1(arg)
            }
            return arg;
          }

        default:
          return function convertArg(arg) {
            for (var i = 0; i < conversions.length; i++) {
              if (tests[i](arg)) {
                return conversions[i](arg);
              }
            }
            return arg;
          }
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
        if (!signature.params.some(p => p.hasConversion)) {
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
      function _splitParams(params, index, paramsSoFar) {
        if (index < params.length) {
          var param = params[index]
          var filteredTypes = ignoreConversionTypes
              ? param.types.filter(isExactType)
              : param.types;
          var resultingParams

          if (param.restParam) {
            // split the types of a rest parameter in two:
            // one with only exact types, and one with exact types and conversions
            var exactTypes = filteredTypes.filter(isExactType)
            if (exactTypes.length < filteredTypes.length) {
              const exactParam = {
                types: exactTypes,
                hasAny: exactTypes.some(t => t.isAny),
                hasConversion: false,
                restParam: true
              }
              resultingParams = [exactParam, {
                types: filteredTypes,
                hasAny: exactTypes.hasAny || filteredTypes.some(t => t.isAny),
                hasConversion: true,
                restParam: true
              }]
            } else { // None of the filtered types were conversions, so:
              resultingParams = [{
                types: filteredTypes,
                hasAny: filteredTypes.some(t => t.isAny),
                hasConversion: false,
                restParam: true
              }]
            }
          }
          else {
            // split all the types of a regular parameter into one type per param
            resultingParams = filteredTypes.map(function (type) {
              return {
                types: [type],
                hasAny: type.isAny,
                hasConversion: type.conversion,
                restParam: false
              }
            })
          }

          // recurse over the groups with types
          return flatMap(resultingParams, function (nextParam) {
            return _splitParams(params, index + 1, paramsSoFar.concat([nextParam]));
          });

        }
        else {
          // we've reached the end of the parameters.
          return [paramsSoFar];
        }
      }

      return _splitParams(params, 0, []);
    }

    /**
     * Test whether two signatures have a conflicting signature
     * @param {Signature} signature1
     * @param {Signature} signature2
     * @return {boolean} Returns true when the signatures conflict, false otherwise.
     */
    function hasConflictingParams(signature1, signature2) {
      var ii = Math.max(signature1.params.length, signature2.params.length);

      for (var i = 0; i < ii; i++) {
        var typesNames1 = getExpectedTypeNames(signature1, i, true);
        var typesNames2 = getExpectedTypeNames(signature2, i, true);

        if (!hasOverlap(typesNames1, typesNames2)) {
          return false;
        }
      }

      var len1 = signature1.params.length;
      var len2 = signature2.params.length;
      var restParam1 = hasRestParam(signature1.params);
      var restParam2 = hasRestParam(signature2.params);

      return restParam1
          ? restParam2 ? (len1 === len2) : (len2 >= len1)
          : restParam2 ? (len1 >= len2)  : (len1 === len2)
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
      typed.createCount++

      if (Object.keys(signaturesMap).length === 0) {
        throw new SyntaxError('No signatures provided');
      }

      // parse the signatures, and check for conflicts
      var parsedSignatures = [];
      Object.keys(signaturesMap)
          .map(function (signature) {
            return parseSignature(signature, signaturesMap[signature], typed.conversions);
          })
          .filter(notNull)
          .forEach(function (parsedSignature) {
            // check whether this parameter conflicts with already parsed signatures
            var conflictingSignature = findInArray(parsedSignatures, function (s) {
              return hasConflictingParams(s, parsedSignature)
            });
            if (conflictingSignature) {
              throw new TypeError('Conflicting signatures "' +
                  stringifyParams(conflictingSignature.params) + '" and "' +
                  stringifyParams(parsedSignature.params) + '".');
            }

            parsedSignatures.push(parsedSignature);
          });

      // split and filter the types of the signatures, and then order them
      var signatures = flatMap(parsedSignatures, function (parsedSignature) {
        var params = parsedSignature ? splitParams(parsedSignature.params, false) : []

        return params.map(function (params) {
          return {
            params: params,
            fn: parsedSignature.fn
          };
        });
      }).filter(notNull);

      signatures.sort(compareSignatures);

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
        return compileArgsPreprocessing(signature.params, signature.fn);
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
            return fns[i].apply(this, arguments);
          }
        }

        return typed.onMismatch(name, arguments, signatures);
      }

      // create the typed function
      // fast, specialized version. Falls back to the slower, generic one if needed
      var fn = function fn(arg0, arg1) {
        'use strict';

        if (arguments.length === len0 && test00(arg0) && test01(arg1)) { return fn0.apply(fn, arguments); }
        if (arguments.length === len1 && test10(arg0) && test11(arg1)) { return fn1.apply(fn, arguments); }
        if (arguments.length === len2 && test20(arg0) && test21(arg1)) { return fn2.apply(fn, arguments); }
        if (arguments.length === len3 && test30(arg0) && test31(arg1)) { return fn3.apply(fn, arguments); }
        if (arguments.length === len4 && test40(arg0) && test41(arg1)) { return fn4.apply(fn, arguments); }
        if (arguments.length === len5 && test50(arg0) && test51(arg1)) { return fn5.apply(fn, arguments); }

        return generic.apply(fn, arguments);
      }

      // attach name the typed function
      try {
        Object.defineProperty(fn, 'name', {value: name});
      }
      catch (err) {
        // old browsers do not support Object.defineProperty and some don't support setting the name property
        // the function name is not essential for the functioning, it's mostly useful for debugging,
        // so it's fine to have unnamed functions.
      }

      // attach signatures to the function
      fn.signatures = createSignaturesMap(signatures);

      return fn;
    }

    /**
     * Action to take on mismatch
     * @param {string} name      Name of function that was attempted to be called
     * @param {Array} args       Actual arguments to the call
     * @param {Array} signatures Known signatures of the named typed-function
     */
    function _onMismatch(name, args, signatures) {
      throw createError(name, args, signatures);
    }

    /**
     * Test whether a type should be NOT be ignored
     * @param {string} typeName
     * @return {boolean}
     */
    function notIgnore(typeName) {
      return typed.ignore.indexOf(typeName) === -1;
    }

    /**
     * trim a string
     * @param {string} str
     * @return {string}
     */
    function trim(str) {
      return str.trim();
    }

    /**
     * Test whether a string is not empty
     * @param {string} str
     * @return {boolean}
     */
    function notEmpty(str) {
      return !!str;
    }

    /**
     * test whether a value is not strict equal to null
     * @param {*} value
     * @return {boolean}
     */
    function notNull(value) {
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

    /**
     * Return all but the last items of an array
     * @param {Array} arr
     * @return {Array}
     */
    function initial(arr) {
      return arr.slice(0, arr.length - 1);
    }

    /**
     * return the last item of an array
     * @param {Array} arr
     * @return {*}
     */
    function last(arr) {
      return arr[arr.length - 1];
    }

    /**
     * Slice an array or function Arguments
     * @param {Array | Arguments | IArguments} arr
     * @param {number} start
     * @param {number} [end]
     * @return {Array}
     */
    function slice(arr, start, end) {
      return Array.prototype.slice.call(arr, start, end);
    }

    /**
     * Test whether an array contains some item
     * @param {Array} array
     * @param {*} item
     * @return {boolean} Returns true if array contains item, false if not.
     */
    function contains(array, item) {
      return array.indexOf(item) !== -1;
    }

    /**
     * Test whether two arrays have overlapping items
     * @param {Array} array1
     * @param {Array} array2
     * @return {boolean} Returns true when at least one item exists in both arrays
     */
    function hasOverlap(array1, array2) {
      for (var i = 0; i < array1.length; i++) {
        if (contains(array2, array1[i])) {
          return true;
        }
      }

      return false;
    }

    /**
     * Return the first item from an array for which test(arr[i]) returns true
     * @param {Array} arr
     * @param {function} test
     * @return {* | undefined} Returns the first matching item
     *                         or undefined when there is no match
     */
    function findInArray(arr, test) {
      for (var i = 0; i < arr.length; i++) {
        if (test(arr[i])) {
          return arr[i];
        }
      }
      return undefined;
    }

    /**
     * Filter unique items of an array with strings
     * @param {string[]} arr
     * @return {string[]}
     */
    function uniq(arr) {
      var entries = {}
      for (var i = 0; i < arr.length; i++) {
        entries[arr[i]] = true;
      }
      return Object.keys(entries);
    }

    /**
     * Flat map the result invoking a callback for every item in an array.
     * https://gist.github.com/samgiles/762ee337dff48623e729
     * @param {Array} arr
     * @param {function} callback
     * @return {Array}
     */
    function flatMap(arr, callback) {
      return Array.prototype.concat.apply([], arr.map(callback));
    }

    /**
     * Check if name is (A) new, (B) a match, or (C) a mismatch; and throw
     * an error in case (C).
     * @param { string | undefined } nameSoFar
     * @param { string | undefined } newName
     * @returns { string } updated name
     */
    function checkName (nameSoFar, newName) {
      if (!nameSoFar) return newName
      if (newName && newName != nameSoFar) {
        const err = new Error('Function names do not match (expected: ' +
          nameSoFar + ', actual: ' + newName + ')')
        err.data = { actual: newName, expected: nameSoFar }
        throw err
      }
      return nameSoFar
    }

    /**
     * Retrieve the implied name from an object with signature keys
     * and function values, checking whether all value names match
     * @param { {string: function} } obj
     */
    function getObjectName (obj) {
      let name
      for (let key in obj) {
        // Only pay attention to own properties, and only if their values
        // are typed functions or functions with a signature property
        if (obj.hasOwnProperty(key) &&
            (typeof obj[key].signatures === 'object' ||
             typeof obj[key].signature === 'string')) {
          name = checkName(name, obj[key].name)
        }
      }
      return name
    }

    /**
     * Copy all of the signatures from the second argument into the first,
     * which is modified by side effect, checking for conflicts
     */
    function mergeSignatures (dest, source) {
      for (let key in source) {
        if (source.hasOwnProperty(key)) {
          if (key in dest) {
            if (source[key] !== dest[key]) {
              const err = new Error('Signature "' + key + '" is defined twice')
              err.data = { signature: key }
              throw err
            }
            // else: both signatures point to the same function, that's fine
          }
          dest[key] = source[key]
        }
      }
    }

    const saveTyped = typed
    /**
     * Originally the main function was a typed function itself, but then
     * it might not be able to generate error messages if the client
     * replaced the type system with different names.
     *
     * Main entry: typed([name], functions/objects with signatures...)
     *
     * Assembles and returns a new typed-function from the given items
     * that provide signatures and implementations, each of which may be
     * * a plain object mapping (string) signatures to implementing functions,
     * * a previously constructed typed function, or
     * * any other single function with a string-valued property `signature`.

     * The name of the resulting typed-function will be given by the
     * string-valued name argument if present, or if not, by the name
     * of any of the arguments that have one, as long as any that do are
     * consistent with each other. If no name is specified, the name will be
     * an empty string.
     *
     * @param {string} name [optional]
     * @param {(function|object)[]} signature providers
     * @returns {typed-function}
     */
    typed = function(maybeName) {
      const named = typeof maybeName === 'string'
      const start = named ? 1 : 0
      let name = named ? maybeName : ''
      const allSignatures = {}
      for (let i = start; i < arguments.length; ++i) {
        const item = arguments[i]
        let theseSignatures = {}
        let thisName
        if (typeof item === 'function') {
          thisName = item.name
          if (typeof item.signature === 'string') {
            // Case 1: Ordinary function with a string 'signature' property
            theseSignatures[item.signature] = item
          } else if (typeof item.signatures === 'object') {
            // Case 2: Existing typed function
            theseSignatures = item.signatures
          }
        } else if (isPlainObject(item)) {
          // Case 3: Plain object, assume keys = signatures, values = functions
          theseSignatures = item
          if (!named) {
            thisName = getObjectName(item)
          }
        }

        if (Object.keys(theseSignatures).length === 0) {
          const err = new TypeError(
            'Argument to \'typed\' at index ' + i + ' is not a (typed) function, ' +
            'nor an object with signatures as keys and functions as values.')
          err.data = { index: i, argument: item }
          throw err
        }

        if (!named) {
          name = checkName(name, thisName)
        }
        mergeSignatures(allSignatures, theseSignatures)
      }

      return createTypedFunction(name || '', allSignatures)
    }

    typed.create = create;
    typed.types = _types;
    typed.conversions = _conversions;
    typed.ignore = _ignore;
    typed.createCount = saveTyped.createCount;
    typed.onMismatch = _onMismatch;
    typed.throwMismatchError = _onMismatch;
    typed.createError = createError;
    typed.convert = convert;
    typed.find = find;

    /**
     * add a type
     * @param {{name: string, test: function}} type
     * @param {boolean} [beforeObjectTest=true]
     *                          If true, the new test will be inserted before
     *                          the test with name 'Object' (if any), since
     *                          tests for Object match Array and classes too.
     */
    typed.addType = function (type, beforeObjectTest) {
      if (!type || typeof type.name !== 'string' || typeof type.test !== 'function') {
        throw new TypeError('Object with properties {name: string, test: function} expected');
      }

      if (beforeObjectTest !== false) {
        for (var i = 0; i < typed.types.length; i++) {
          if (typed.types[i].name === 'Object') {
            typed.types.splice(i, 0, type);
            return
          }
        }
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

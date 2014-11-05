/**
 * typed-function
 *
 * Type checking for JavaScript functions
 *
 * https://github.com/josdejong/typed-function
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.typed = factory();
  }
}(this, function () {
  'use strict';

  // order types
  // anytype (*) will be ordered last, and then object, as other types may be
  // an object too.
  function compareTypes(a, b) {
    if (a === '*') return 1;
    if (b === '*') return -1;

    if (a === 'Object') return 1;
    if (b === 'Object') return -1;

    return 0;
  }

  // order numbers
  function compareNumbers(a, b) {
    return a > b;
  }

  /**
   * Collection with function definitions (local shortcuts to functions)
   * @constructor
   */
  function Defs() {}

  /**
   * Add a function definition.
   * @param {function} fn
   * @param {string} [type='fn']
   * @returns {string} Returns the function name, for example 'fn0' or 'signature2'
   */
  Defs.prototype.add = function (fn, type) {
    type = type || 'fn';
    if (!this[type]) this[type] = [];

    var index = this[type].indexOf(fn);
    if (index == -1) {
      index = this[type].length;
      this[type].push(fn);
    }
    return type + index;
  };

  /**
   * Create code lines for all definitions
   * @param [name='defs']
   * @returns {Array} Returns the code lines containing all function definitions
   */
  Defs.prototype.code = function (name) {
    var me = this;
    var code = [];
    name = name || 'defs';

    Object.keys(this).forEach(function (type) {
      var def = me[type];
      def.forEach(function (def, index) {
        code.push('var ' + type + index + ' = ' + name + '[\'' + type + '\'][' + index + '];');
      });
    });

    return code;
  };

  /**
   * A function signature
   * @param {string | Array.<string>} params  Array with the type(s) of each parameter,
   *                                          or a comma separated string with types
   * @param {function} fn                     The actual function
   * @constructor
   */
  function Signature(params, fn) {
    if (typeof params === 'string') {
      this.params = (params !== '') ? params.split(',').map(function (param) {
        return param.trim();
      }) : [];
    }
    else {
      this.params = params;
    }
    this.fn = fn;
  }

  // TODO: implement function Signature.split
  // TODO: implement function Signature.merge
  // TODO: implement function Signature.toString

  /**
   * split all raw signatures into an array with splitted params
   * @param {Object.<string, function>} rawSignatures
   * @return {Array.<{params: Array.<string>, fn: function}>} Returns splitted signatures
   */
  function splitSignatures(rawSignatures) {
    return Object.keys(rawSignatures).map(function (params) {
      var fn = rawSignatures[params];
      return new Signature(params, fn);
    });

    // TODO: split params containing an '|' into multiple entries
  }

  /**
   * create a map with normalized signatures as key and the function as value
   * @param {Array.<{params: Array.<string>, fn: function}>} signatures   An array with splitted signatures
   * @return {{}} Returns a map with normalized signatures
   */
  function normalizeSignatures(signatures) {
    var normalized = {};

    signatures.map(function (entry) {
      var signature = entry.params.join(',');
      if (signature in normalized) {
        throw new Error('Error: signature "' + signature + '" defined twice');
      }
      normalized[signature] = entry.fn;
    });

    return normalized
  }

  /**
   * create an array with for every parameter an array with possible types
   * @param {Array.<{params: Array.<string>, fn: function}>} signatures   An array with splitted signatures
   * @return {Array.<Array.<string>>} Returns an array with allowed types per parameter
   */
  function splitTypes(signatures) {
    var types = [];

    signatures.forEach(function (entry) {
      entry.params.forEach(function (param, i) {
        if (!types[i]) {
          types[i] = [];
        }
        if (types[i].indexOf(param) == -1) {
          types[i].push(param);
        }
      });
    });

    return types;
  }

  /**
   * create a recursive tree for traversing the number and type of parameters
   * @param {Array.<{params: Array.<string>, fn: function}>} signatures   An array with splitted signatures
   * @returns {{}}
   */
  function createParamsTree(signatures) {
    var tree = {};

    signatures.forEach(function (entry) {
      var params = entry.params.concat([]);

      // get the tree entry for the current number of arguments
      var obj = tree[params.length];
      if (!obj) {
        obj = tree[params.length] = {
          signature: [],
          fn: null,
          types: {}
        };
      }

      // loop over all parameters, create a nested structure
      while(params.length > 0) {
        var param = params.shift();
        if (!obj.types[param]) {
          obj.types[param] = {
            signature: obj.signature.concat(param),
            fn: null,
            types: {}
          };
        }
        obj = obj.types[param];
      }

      // add the function as leaf
      obj.fn = entry.fn;
    });

    return tree;
  }

  /**
   * Compose a function from sub-functions each handling a single type signature.
   * @param {string} [name]  An optional name for the function
   * @param {Object.<string, function>} signatures
   *            A map with the type signature as key and the sub-function as value
   * @return {function} Returns the composed function
   */
  function typed(name, signatures) {
    // handle arguments
    if (!signatures) {
      signatures = name;
      name = null;
    }

    var defs = new Defs();
    var structure = splitSignatures(signatures);

    function switchTypes(signature, args, prefix) {
      var code = [];

      if (signature.fn !== null) {
        var def = defs.add(signature.fn, 'signature');
        code.push(prefix + 'return ' + def + '(' + args.join(', ') +'); // signature: ' + signature.signature);
      }
      else {
        // add entries for the provided types
        Object.keys(signature.types)
            .sort(compareTypes)
            .forEach(function (type, index) {
              var arg = 'arg' + args.length;

              var before;
              var after;
              var nextPrefix = prefix + '  ';
              if (type == '*') {
                before = (index > 0 ? 'else {' : '');
                after  = (index > 0 ? '}' : '');
                if (index == 0) {nextPrefix = prefix;}
              }
              else {
                var def = defs.add(getTest(type), 'test') + '(' + arg + ')';
                before = 'if (' + def + ') { // type: ' + type;
                after  = '}';
              }

              if (before) code.push(prefix + before);
              code = code.concat(switchTypes(signature.types[type], args.concat(arg), nextPrefix));
              if (after) code.push(prefix + after);
            });

        // add entries for type conversions
        var added = {};
        typed.conversions
            .filter(function (conversion) {
              return signature.types[conversion.to] &&
                  !signature.types[conversion.from];
            })
            .forEach(function (conversion) {
              if (!added[conversion.from]) {
                added[conversion.from] = true;

                var arg = 'arg' + args.length;
                var test = defs.add(getTest(conversion.from), 'test') + '(' + arg + ')';
                var convert = defs.add(conversion.convert, 'convert') + '(' + arg + ')';

                code.push(prefix + 'if (' + test + ') { // type: ' + conversion.from + ', convert to ' + conversion.to);
                code = code.concat(switchTypes(signature.types[conversion.to], args.concat(convert), prefix + '  '));
                code.push(prefix + '}');
              }
            });
      }

      return code;
    }

    var types = splitTypes(structure);
    var params = [];
    for (var i = 0; i < types.length; i++) { // we can't use .map here, some entries may be undefined
      params.push('arg' + i);
    }

    var code = [];
    var tree = createParamsTree(structure);
    var paramCounts = Object.keys(tree);
    code.push('return function ' + (name || '') + '(' + params.join(', ') + ') {');
    paramCounts
        .sort(compareNumbers)
        .forEach(function (count, index) {
          var signature = tree[count];
          var args = [];
          var statement = (index == 0) ? 'if' : 'else if';
          code.push('  ' + statement + ' (arguments.length == ' + count +  ') {');
          code = code.concat(switchTypes(signature, args, '    '));

          code.push('  }');
          if (index == paramCounts.length - 1) {
            code.push('  else {');
            code.push('    throw new TypeError(\'Wrong number of arguments\');'); // TODO: output the allowed numbers
            code.push('  }');
          }
        });
    code.push('  throw new TypeError(\'Wrong function signature\');');  // TODO: output the actual signature
    code.push('}');

    var factory = [];
    factory.push('(function (defs) {');
    factory = factory.concat(defs.code('defs'));
    factory = factory.concat(code);
    factory.push('})');

    var fn = eval(factory.join('\n'))(defs);

    // attach the signatures with sub-functions to the constructed function
    fn.signatures = normalizeSignatures(structure); // normalized signatures

    return fn;
  }

  // data type tests
  typed.types = {
    'null':     function (x) {return x === null},
    'boolean':  function (x) {return typeof x === 'boolean'},
    'number':   function (x) {return typeof x === 'number'},
    'string':   function (x) {return typeof x === 'string'},
    'function': function (x) {return typeof x === 'function'},
    'Array':    function (x) {return Array.isArray(x)},
    'Date':     function (x) {return x instanceof Date},
    'RegExp':   function (x) {return x instanceof RegExp},
    'Object':   function (x) {return typeof x === 'object'}
  };

  function getTest(type) {
    var test = typed.types[type];
    if (!test) {
      var matches = Object.keys(typed.types)
          .filter(function (t) {
            return t.toLowerCase() == type.toLowerCase();
          })
          .map(function (t) {
            return '"' + t + '"';
          });
      throw new Error('Unknown type "' + type + '"' +
      (matches.length ? ('. Did you mean ' + matches.join(', or ') + '?') : ''));
    }
    return test;
  }

  // type conversions
  // order is important
  typed.conversions = [];

  return typed;
}));


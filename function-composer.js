/**
 * Function composer
 * https://github.com/josdejong/function-composer
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
    root.compose = factory();
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
   * Analyze a flat map with signatures
   * @param {Object.<string, function>} signatures
   * @return {{tree: Object, signatures: Object.<string, function>, args: Array.<Array>}}
   *    Returns an object with properties:
   *    - `tree`: nested map with all supported types per parameter
   *    - `signatures`: flat map with normalized signatures
   *    - `args`: array with arrays with the supported types
   */
  function analyse(signatures) {
    // analyse all signatures
    var normalized = {}; // normalized signatures
    var tree = {};
    var args = [];

    Object.keys(signatures).forEach(function (signature) {
      var fn = signatures[signature];
      var params = (signature !== '') ? signature.split(',').map(function (param) {
        return param.trim();
      }) : [];
      var normSignature = params.join(',');
      normalized[normSignature] = fn;

      // add types of this signature to args
      params.forEach(function (param, i) {
        if (!args[i]) args[i] = [];
        if (args[i].indexOf(param) == -1) args[i].push(param);
      });

      // get the parameter entry for this number of arguments
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

      obj.fn = fn;
    });

    return {
      tree: tree,
      signatures: normalized,
      args: args
    }
  }

  /**
   * Compose a function from sub-functions each handling a single type signature.
   * @param {string} [name]  An optional name for the function
   * @param {Object.<string, function>} signatures
   *            A map with the type signature as key and the sub-function as value
   * @return {function} Returns the composed function
   */
  function compose(name, signatures) {
    if (!signatures) {
      signatures = name;
      name = null;
    }

    var structure = analyse(signatures);

    // collected function definitions (local shortcuts to functions)
    var defs = new Defs();

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
        compose.conversions
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

    var args = [];
    for (var i = 0; i < structure.args.length; i++) {
      args.push('arg' + i);
    }

    var code = [];
    var counts = Object.keys(structure.tree);
    code.push('return function ' + (name || '') + '(' + args.join(', ') + ') {');
    counts
        .sort(compareNumbers)
        .forEach(function (count, index) {
          var signature = structure.tree[count];
          var args = [];
          var statement = (index == 0) ? 'if' : 'else if';
          code.push('  ' + statement + ' (arguments.length == ' + count +  ') {');
          code = code.concat(switchTypes(signature, args, '    '));

          code.push('  }');
          if (index == counts.length - 1) {
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

    // attach the original functions
    fn.signatures = structure.signatures; // normalized signatures

    return fn;
  }

  // data type tests
  compose.tests = {
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
    var test = compose.tests[type];
    if (!test) {
      var matches = Object.keys(compose.tests)
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
  compose.conversions = [];

  return compose;
}));


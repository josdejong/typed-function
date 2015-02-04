/**
 * typed-function
 *
 * Type checking for JavaScript functions
 *
 * https://github.com/josdejong/typed-function
 */
(function (factory) {
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
    window.typed = factory();
  }
}(function () {
  'use strict';

  /**
   * Order Params
   * any type ('any') will be ordered last, and object as second last (as other types
   * may be an object as well, like Array)
   * @param {Param} a
   * @param {Param} b
   * @returns {number} Returns 1 if a > b, -1 if a < b, and else 0.
   */
  function compareParams(a, b) {
    if (a.anyType) return 1;
    if (a.anyType) return -1;

    if (contains(a.types, 'Object')) return 1;
    if (contains(b.types, 'Object')) return -1;

    return 0;
  }

  /**
   * Merge multiple objects.
   * Expects one or more Objects as input arguments
   */
  function merge () {
    var obj = {};

    for (var i = 0; i < arguments.length; i++) {
      var o = arguments[i];
      for (var prop in o) {
        if (o.hasOwnProperty(prop)) {
          obj[prop] = o[prop];
        }
      }
    }

    return obj;
  }

  /**
   * Get a type test function for a specific data type
   * @param {string} type                   A data type like 'number' or 'string'
   * @returns {function(obj: *) : boolean}  Returns a type testing function.
   *                                        Throws an error for an unknown type.
   */
  function getTypeTest(type) {
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

  /**
   * Create an ArgumentsError. Creates messages like:
   *
   *   Unexpected type of argument (expected: ..., actual: ..., index: ...)
   *   Too few arguments (expected: ..., index: ...)
   *   Too many arguments (expected: ..., actual: ...)
   *
   * @param {String} fn         Function name
   * @param {Object} args       The actual arguments
   * @param {Number} index      Current argument index
   * @param {string} [expected] An optional, comma separated string with
   *                            expected types on given index
   * @extends Error
   */
  function createError(fn, args, index, expected) {
    var actual = args[index];
    var actualType = getTypeOf(actual);
    var _expected = expected ? expected.split(',') : null;
    var anyType = _expected && contains(_expected, 'any');
    var message;
    var data = {
      fn: fn,
      index: index,
      actual: actual,
      expected: _expected
    };

    //console.log('createError', fn, args, index, expected) // TODO: cleanup

    // TODO: add function name to the message
    if (_expected) {
      if (args.length > index && !anyType) {
        // unexpected type
        message = 'Unexpected type of argument' +
            ' (expected: ' + _expected.join(' or ') + ', actual: ' + actualType + ', index: ' + index + ')';
      }
      else {
        // too few arguments
        message = 'Too few arguments' +
          ' (expected: ' + _expected.join(' or ') + ', index: ' + index + ')';
      }
    }
    else {
      // too many arguments
      message = 'Too many arguments' +
          ' (expected: ' + index + ', actual: ' + args.length + ')'
    }

    var err = new TypeError(message);
    err.data = data;
    return err;
  }

  /**
   * Collection with function references (local shortcuts to functions)
   * @constructor
   * @param {string} [name='refs']  Optional name for the refs, used to generate
   *                                JavaScript code
   */
  function Refs(name) {
    this.name = name || 'refs';
    this.categories = {};
  }

  /**
   * Add a function reference.
   * @param {function} fn
   * @param {string} [category='fn']    A function category, like 'fn' or 'signature'
   * @returns {string} Returns the function name, for example 'fn0' or 'signature2'
   */
  Refs.prototype.add = function (fn, category) {
    var cat = category || 'fn';
    if (!this.categories[cat]) this.categories[cat] = [];

    var index = this.categories[cat].indexOf(fn);
    if (index == -1) {
      index = this.categories[cat].length;
      this.categories[cat].push(fn);
    }
    
    return cat + index;
  };

  /**
   * Create code lines for all function references
   * @returns {string} Returns the code containing all function references
   */
  Refs.prototype.toCode = function () {
    var code = [];
    var path = this.name + '.categories';
    var categories = this.categories;

    Object.keys(categories).forEach(function (cat) {
      categories[cat].forEach(function (ref, index) {
        code.push('var ' + cat + index + ' = ' + path + '[\'' + cat + '\'][' + index + '];');
      });
    });
    
    return code.join('\n');
  };

  /**
   * A function parameter
   * @param {string | string[] | Param} types    A parameter type like 'string',
   *                                             'number | boolean'
   * @param {boolean} [varArgs=false]            Variable arguments if true
   * @constructor
   */
  function Param(types, varArgs) {
    // parse the types, can be a string with types separated by pipe characters |
    if (typeof types === 'string') {
      // parse variable arguments operator (ellipses '...number')
      var _varArgs = (types.substring(0, 3) === '...');
      var _types = _varArgs ? types.substr(3) : types;
      if (_types === '') {
        this.types = ['any'];
      }
      else {
        this.types = _types.split('|').map(function (type) {
          return type.trim();
        });
      }
    }
    else if (Array.isArray(types)) {
      this.types = types;
    }
    else if (types instanceof Param) {
      return types.clone();
    }
    else {
      throw new Error('String or Array expected');
    }

    // can hold a type to which to convert when handling this parameter
    this.conversions = [];
    // TODO: better implement support for conversions, be able to add conversions via constructor (support a new type Object?)

    // variable arguments
    this.varArgs = _varArgs || varArgs || false;

    // check for any type arguments
    this.anyType = this.types.some(function (type) {
      return type == 'any';
    });
  }

  /**
   * Test whether this parameters types equal an other parameters types.
   * Does not take into account varArgs.
   * @param {Param} other
   * @return {boolean} Returns true when the types are equal.
   */
  Param.prototype.equalTypes = function (other) {
    return this.types.sort().join() == other.types.sort().join();
  };

  /**
   * Test whether this parameters types conflict an other parameters types.
   * Does not take into account varArgs.
   * @param {Param} other
   * @return {boolean} Returns true when there are conflicting types
   */
  // TODO: cleanup when unused
  Param.prototype.conflictingTypes = function (other) {
    return this.types.some(function (type) {
      return contains(other.types, type);
    });
  };

  /**
   * Create a clone of this param
   * @returns {Param} Returns a cloned version of this param
   */
  Param.prototype.clone = function () {
    var param = new Param(this.types.slice(), this.varArgs);
    param.conversions = this.conversions.slice();
    return param;
  };

  /**
   * Test whether this parameter contains conversions
   * @returns {boolean} Returns true if the parameter contains one or
   *                    multiple conversions.
   */
  Param.prototype.hasConversions = function () {
    return this.conversions.length > 0;
  };

  /**
   * Return a string representation of this params types, like 'string' or
   * 'number | boolean' or '...number'
   * @param {boolean} [toConversion]   If true, the returned types string
   *                                   contains the types where the parameter
   *                                   will convert to. If false (default)
   *                                   the "from" types are returned
   * @returns {string}
   */
  Param.prototype.toString = function (toConversion) {
    var types = this.types
        .map(function (type, i) {
          var conversion = this.conversions[i];
          return toConversion && conversion ? conversion.to : type;
        }.bind(this))
        .filter(function (type, i, types) {
          return types.indexOf(type) === i;  // dedupe array
        });

    return (this.varArgs ? '...' : '') + types.join('|');
  };

  /**
   * A function signature
   * @param {string | string[] | Param[]} params
   *                         Array with the type(s) of each parameter,
   *                         or a comma separated string with types
   * @param {function} fn    The actual function
   * @constructor
   */
  function Signature(params, fn) {
    if (typeof params === 'string') {
      this.params = (params !== '') ? params.split(',').map(function (types) {
        return new Param(types);
      }) : [];
    }
    else if (Array.isArray(params)) {
      this.params = params.map(function (types) {
        return new Param(types);
      });
    }
    else {
      throw new Error('string or Array expected');
    }

    // check variable arguments operator '...'
    var withVarArgs = this.params.filter(function (param) {
      return param.varArgs;
    });
    if (withVarArgs.length === 0) {
      this.varArgs = false;
    }
    else if (withVarArgs[0] === this.params[this.params.length - 1]) {
      this.varArgs = true;
    }
    else {
      throw new SyntaxError('Unexpected variable arguments operator "..."');
    }

    this.fn = fn;
  }

  /**
   * Create a clone of this signature
   * @returns {Signature} Returns a cloned version of this signature
   */
  Signature.prototype.clone = function () {
    return new Signature(this.params.slice(), this.fn);
  };

  /**
   * Expand a signature: split params with union types in separate signatures
   * For example split a Signature "string | number" into two signatures.
   * @return {Signature[]} Returns an array with signatures (at least one)
   */
  Signature.prototype.expand = function () {
    var signatures = [];

    function recurse(signature, path) {
      if (path.length < signature.params.length) {
        var param = signature.params[path.length];
        if (signature.varArgs) {
          // a variable argument. do not split the types in the parameter
          recurse(signature, path.concat(param));
        }
        else {
          // split each type in the parameter
          param.types.forEach(function (type) {
            recurse(signature, path.concat(new Param(type, param.varArgs)));
          });
        }
      }
      else {
        signatures.push(new Signature(path, signature.fn));
      }
    }
    recurse(this, []);

    return signatures;
  };

  /**
   * Generate the code to invoke this signature
   * @param {Refs} refs
   * @param {string} prefix
   * @returns {string} Returns code
   */
  Signature.prototype.toCode = function (refs, prefix) {
    var code = [];
    var args = this.params.map(function (param, index) {
      var conversion = param.conversions[0];
      if (param.varArgs) {
        return 'varArgs';
      }
      else if (conversion) {
        return refs.add(conversion.convert, 'convert') + '(arg' + index + ')';
      }
      else {
        return 'arg' + index;
      }
    }).join(', ');
    var ref = this.fn ? refs.add(this.fn, 'signature') : undefined;
    if (ref) {
      return prefix + 'return ' + ref + '(' + args  + '); // signature: ' + this.params.join(', ');
    }

    return code.join('\n');
  };

  /**
   * Return a string representation of the signature
   * @returns {string}
   */
  Signature.prototype.toString = function () {
    return this.params.join(', ');
  };

  /**
   * A group of signatures with the same parameter on given index
   * @param {Param[]} path
   * @param {Signature} [signature]
   * @param {Node[]} childs
   * @constructor
   */
  function Node(path, signature, childs) {
    this.path = path || [];
    this.param = path[path.length - 1] || null;
    this.signature = signature || null;
    this.childs = childs || [];
  }

  /**
   * Generate code for this group of signatures
   * @param {Refs} refs
   * @param {string} prefix
   * @returns {string} Returns the code as string
   */
  Node.prototype.toCode = function (refs, prefix) {
    var code = [];

    if (this.param) {
      var index = this.path.length - 1;
      var conversion = this.param.conversions[0];
      var comment = '// type: ' + (conversion ?
          (conversion.from + ' (convert to ' + conversion.to + ')') :
          this.param);

      // non-root node (path is non-empty)
      if (this.param.varArgs) {
        if (this.param.anyType) {
          // variable arguments with any type
          code.push(prefix + 'if (arguments.length > ' + index + ') {');
          code.push(prefix + '  var varArgs = [];');
          code.push(prefix + '  for (var i = ' + index + '; i < arguments.length; i++) {');
          code.push(prefix + '    varArgs.push(arguments[i]);');
          code.push(prefix + '  }');
          code.push(this.signature.toCode(refs, prefix + '  '));
          code.push(prefix + '}');
        }
        else {
          // variable arguments with a fixed type
          var getTests = function (types, arg) {
            return types
                .map(function (type) {
                  return refs.add(getTypeTest(type), 'test') + '(' + arg + ')';
                })
                .join(' || ');
          }.bind(this);

          var allTypes = this.param.types;
          var exactTypes = allTypes.filter(function (type, i) {
            return this.param.conversions[i] === undefined;
          }.bind(this));
          var conversionTypes = allTypes.filter(function (type, i) {
            return this.param.conversions[i] !== undefined;
          }.bind(this));
          console.log('TYPES', allTypes, exactTypes, conversionTypes)

          code.push(prefix + 'if (' + getTests(allTypes, 'arg' + index) + ') { ' + comment);
          code.push(prefix + '  var varArgs = [arg' + index + '];');
          code.push(prefix + '  for (var i = ' + (index + 1) + '; i < arguments.length; i++) {');
          code.push(prefix + '    if (' + getTests(exactTypes, 'arguments[i]') + ') {');
          code.push(prefix + '      varArgs.push(arguments[i]);');
          allTypes.forEach(function (type, i) {
            var conversion = this.param.conversions[i];
            if (conversion) {
              var test = refs.add(getTypeTest(type), 'test');
              var convert = refs.add(conversion.convert, 'convert');
              code.push(prefix + '    }');
              code.push(prefix + '    else if (' + test + '(arguments[i])) {');
              code.push(prefix + '      varArgs.push(' + convert + '(arguments[i]));');
            }
          }.bind(this));
          code.push(prefix + '    } else {');
          code.push(prefix + '      throw createError(\'\', arguments, i, \'' + allTypes.join(',') + '\');');
          code.push(prefix + '    }');
          code.push(prefix + '  }');
          code.push(this.signature.toCode(refs, prefix + '  '));
          code.push(prefix + '}');
        }
      }
      else {
        if (this.param.anyType) {
          // any type
          code.push(prefix + '// type: any');
          code.push(this._innerCode(refs, prefix));
        }
        else {
          // regular type
          var type = this.param.types[0];
          var test = type !== 'any' ? refs.add(getTypeTest(type), 'test') : null;

          code.push(prefix + 'if (' + test + '(arg' + index + ')) { ' + comment);
          code.push(this._innerCode(refs, prefix + '  '));
          code.push(prefix + '}');
        }
      }
    }
    else {
      // root node (path is empty)
      code.push(this._innerCode(refs, prefix));
    }

    return code.join('\n');
  };

  /**
   * Generate inner code for this group of signatures.
   * This is a helper function of Node.prototype.toCode
   * @param {Refs} refs
   * @param {string} prefix
   * @returns {string} Returns the inner code as string
   * @private
   */
  Node.prototype._innerCode = function(refs, prefix) {
    var code = [];

    if (this.signature) {
      code.push(prefix + 'if (arguments.length === ' + this.path.length + ') {');
      code.push(this.signature.toCode(refs, prefix + '  '));
      code.push(prefix + '}');
    }

    this.childs.forEach(function (child) {
      code.push(child.toCode(refs, prefix));
    });

    var exceptions = this._exceptions(refs, prefix);
    if (exceptions) {
      code.push(exceptions);
    }

    return code.join('\n');
  };

  /**
   * Generate code to throw exceptions
   * @param {Refs} refs
   * @param {string} prefix
   * @returns {string} Returns the inner code as string
   * @private
   */
  Node.prototype._exceptions = function (refs, prefix) {
    var index = this.path.length;

    // TODO: add function name to exceptions
    if (this.childs.length === 0) {
      // TODO: can this condition be simplified? (we have a fall-through here)
      return [
        prefix + 'if (arguments.length > ' + index + ') {',
        prefix + '  throw createError(\'\', arguments, ' + index + ')',
        prefix + '}'
      ].join('\n');
    }
    else {
      var arg = 'arg' + index;
      var types = this.childs.reduce(function (types, node) {
        // TODO: filter non-converted types
        return node.param ? types.concat(node.param.types) : types;
      }, []);

      return prefix + 'throw createError(\'\', arguments, ' + index + ', \'' + types.join(',') + '\');';
    }
  };

  /**
   * Split all raw signatures into an array with (split) Signatures
   * @param {Object.<string, function>} rawSignatures
   * @return {Signature[]} Returns an array with split signatures
   */
  function parseSignatures(rawSignatures) {
    return Object.keys(rawSignatures).reduce(function (signatures, types) {
      var fn = rawSignatures[types];
      var signature = new Signature(types, fn);

      return signatures.concat(signature.expand()); // TODO: this should be redundant: can be done by splitParams?
    }, []);
  }

  /**
   * Split parameters per argument index, and add conversions
   * @param {Signature[]} signatures
   * @returns {Array.<Array.<Param>>}
   *            Returns an array with parameters grouped per argument index
   */
  function splitParams(signatures) {
    var all = [];

    signatures.forEach((function (signature) {
      signature.params.forEach(function(param, index) {
        var params = all[index] || (all[index] = []);
        if (param.varArgs) {
          addParam(params, param.clone());
        }
        else {
          param.types.forEach(function (type) {
            addParam(params, new Param(type));
          });
        }
      });
    }));

    all.forEach(function (params) {
      // filter the relevant conversions for argument i, and add new params for them
      typed.conversions.forEach(function (conversion) {
        var exists = params.some(function (param) {
          return contains(param.types, conversion.from);
        });

        if (!exists) {
          addConversion(params, conversion);
        }
      });

      // order the parameters (*, Object, any)
      params.sort(compareParams);
    });

    return all;
  }

  /**
   * Helper function to add a new entry to an array with parameters.
   * Tests for conflicts. Used by function splitParams.
   * @param {Array.<Param>} params
   * @param {Param} param
   */
  function addParam (params, param) {
    var existing = params.filter(function (p) {
      return p.conflictingTypes(param);
    })[0];

    if (existing) {
      if (existing.varArgs) {
        throw new Error('Conflicting types "' + param + '" and "' + existing + '"');
      }
      // else: nothing to do
    } else {
      params.push(param);
    }
  }

  /**
   * Helper function to add a new entry to an array with parameters.
   * Tests for conflicts. Used by function splitParams.
   * @param {Array.<Param>} params
   * @param {{from: string, to: string, convert: function}} conversion
   */
  function addConversion(params, conversion) {
    var existing = params.filter(function (param) {
      return contains(param.types, conversion.to) && !param.hasConversions();
    })[0];
    console.log('MATCH', existing && existing.toString())

    if (existing) {
      if (existing.varArgs) {
        var index = existing.types.length;
        existing.types[index] = conversion.from;
        existing.conversions[index] = conversion;
      }
      else {
        var newParam = new Param(conversion.from);
        newParam.conversions[0] = conversion;
        console.log('add new param', newParam.toString())
        params.push(newParam);
      }
    }
  }

  /**
   * create a map with normalized signatures as key and the function as value
   * @param {Signature[]} signatures   An array with split signatures
   * @return {Object} Returns a map with normalized signatures
   */
  function mapSignatures(signatures) {
    return signatures.reduce(function (normalized, entry) {
      var signature = entry.params.join(',');
      if (normalized[signature]) {
        throw new Error('Signature "' + signature + '" is defined twice');
      }
      normalized[signature] = entry;
      return normalized;
    }, {});
  }

  /**
   * Parse signatures recursively in a node tree.
   * @param {Object.<string,Signature>} signatures  Hash map with signatures
   * @param {Array.<Array.<Param>>} params
   *                            Expanded parameters per argument
   * @param {Param[]} path      Path with parameters to this node
   * @return {Node}             Returns a node tree
   */
  function parseTree(signatures, params, path) {
    var index = path.length;

    var params_i = params[index];
    var childs = (params_i || []).reduce(function (childs, param) {
      var child = parseTree(signatures, params, path.concat(param));
      if (child !== null) {
        childs.push(child);
      }
      return childs;
    }, []);

    //console.log('parseTree', path.join(', '), signature ? 'YES!' : 'no', signature instanceof Signature, childs.length);

    var toPath = path.map(function (param) {
      return param.toString(true);
    });
    console.log('TO PATH', toPath)
    var signature = signatures[toPath.join(',')] || null;

    if (signature !== null || childs.length > 0) {
      return new Node(path, signature && new Signature(path, signature.fn), childs);
    }
    else {
      return null;
    }
  }

  /**
   * Generate an array like ['arg0', 'arg1', 'arg2']
   * @param {number} count Number of arguments to generate
   * @returns {Array} Returns an array with argument names
   */
  function getArgs(count) {
    // create an array with all argument names
    var args = [];
    for (var i = 0; i < count; i++) {
      args[i] = 'arg' + i;
    }

    return args;
  }

  /**
   * Compose a function from sub-functions each handling a single type signature.
   * Signatures:
   *   typed(signature: string, fn: function)
   *   typed(name: string, signature: string, fn: function)
   *   typed(signatures: Object.<string, function>)
   *   typed(name: string, signatures: Object.<string, function>)
   *
   * @param {string | null} name
   * @param {Object.<string, function>} signatures
   * @return {function} Returns the typed function
   * @private
   */
  function _typed(name, signatures) {
    var refs = new Refs();

    // parse signatures, expand them
    var _signatures = parseSignatures(signatures);
    if (_signatures.length == 0) {
      throw new Error('No signatures provided'); // TODO: is this error needed?
    }

    console.log('EXPANDED SIGNATURES', _signatures.map(function (s) {return s.toString()}))

    var params = splitParams(_signatures);

    console.log('PARAMS', params.map(function (params_i) {
      return params_i.map(function (param) {
        return param.toString() +
          (param.hasConversions() ? (' (to ' + JSON.stringify(param.conversions) + ')') :'')
      });
    }));

    // change from an array to a map
    var _signaturesMap = mapSignatures(_signatures);

    // parse signatures into a node tree
    var node = parseTree(_signaturesMap, params, []);

    //var util = require('util');
    //console.log('ROOT');
    //console.log(util.inspect(node, { depth: null }));

    // generate code for the typed function
    var code = [];
    var _name = name || '';
    var _args = getArgs(maxParams(_signatures));
    code.push('function ' + _name + '(' + _args.join(', ') + ') {');
    code.push(node.toCode(refs, '  '));
    code.push('}');

    // generate code for the factory function
    var factory = [
      '(function (' + refs.name + ') {',
      refs.toCode(),
      'return ' + code.join('\n'),
      '})'
    ].join('\n');

    // evaluate the JavaScript code and attach function references
    var fn = eval(factory)(refs);

    console.log('FN\n' + fn.toString()); // TODO: cleanup

    // attach the signatures with sub-functions to the constructed function
    fn.signatures = {}; // hash map with signatures
    for (var prop in _signaturesMap) {
      if (_signaturesMap.hasOwnProperty(prop)) {
        fn.signatures[prop] = _signaturesMap[prop].fn;
      }
    }
    // TODO: also add converted signatures to the map?

    return fn;
  }

  // data type tests
  var types = {
    'null':     function (x) {return x === null},
    'undefined':function (x) {return x === undefined},
    'boolean':  function (x) {return typeof x === 'boolean'},
    'number':   function (x) {return typeof x === 'number'},
    'string':   function (x) {return typeof x === 'string'},
    'function': function (x) {return typeof x === 'function'},
    'Array':    function (x) {return Array.isArray(x)},
    'Date':     function (x) {return x instanceof Date},
    'RegExp':   function (x) {return x instanceof RegExp},
    'Object':   function (x) {return typeof x === 'object'}
  };

  /**
   * Calculate the maximum number of parameters in givens signatures
   * @param {Signature[]} signatures
   * @returns {number} The maximum number of parameters
   */
  function maxParams(signatures) {
    return signatures.reduce(function (max, signature) {
      return Math.max(max, signature.params.length);
    }, 0);
  }

  /**
   * Get the type of a value
   * @param {*} x
   * @returns {string} Returns a string with the type of value
   */
  function getTypeOf(x) {
    for (var type in types) {
      if (types.hasOwnProperty(type)) {
        if (types[type](x)) return type;
      }
    }
    return 'unknown';
  }

  /**
   * Test whether an array contains some entry
   * @param {Array} array
   * @param {*} entry
   * @return {boolean} Returns true if array contains entry, false if not.
   */
  function contains(array, entry) {
    return array.indexOf(entry) !== -1;
  }

  /**
   * Transpose a two dimensional matrix. Supports unbalanced matrices.
   * For example [[1,2],[3,4,5]] returns [[1,3],[2,4],[5]]
   * @param {Array}array
   * @returns {Array} Returns the transposed array
   */
  // TODO: cleanup, not used
  function transpose(array) {
    var res = [];
    for (var r = 0; r < array.length; r++) {
      var row = array[r];
      for (var c = 0; c < row.length; c++) {
        var entry = row[c];
        res[c] ? res[c].push(entry) : res[c] = [entry];
      }
    }
    return res;
  }

  // configuration
  var config = {};

  // type conversions. Order is important
  var conversions = [];

  // temporary object for holding types and conversions, for constructing
  // the `typed` function itself
  // TODO: find a more elegant solution for this
  var typed = {
    config: config,
    types: types,
    conversions: conversions
  };

  /**
   * Construct the typed function itself with various signatures
   *
   * Signatures:
   *
   *   typed(signature: string, fn: function)
   *   typed(name: string, signature: string, fn: function)
   *   typed(signatures: Object.<string, function>)
   *   typed(name: string, signatures: Object.<string, function>)
   */
  typed = _typed('typed', {
    'Object': function (signatures) {
      return _typed(null, signatures);
    },
    'string, Object': _typed,
    'string, function': function (signature, fn) {
      var signatures = {};
      signatures[signature] = fn;
      return _typed(fn.name || null, signatures);
    },
    'string, string, function': function(name, signature, fn) {
      var signatures = {};
      signatures[signature] = fn;
      return _typed(name, signatures);
    },
    '...function': function (fns) {
      var name = '';
      var signatures = {};
      fns.forEach(function (fn, index) {
        var err;

        // test whether this is a typed-function
        if (!(typeof fn.signatures === 'object')) {
          err = new TypeError('Function is no typed-function (index: ' + index + ')');
          err.data = {index: index};
          throw err;
        }

        // merge the signatures
        for (var signature in fn.signatures) {
          if (fn.signatures.hasOwnProperty(signature)) {
            if (signatures.hasOwnProperty(signature)) {
              err = new Error('Conflicting signatures: "' + signature + '" is defined twice.');
              err.data = {signature: signature};
              throw err;
            }
            else {
              signatures[signature] = fn.signatures[signature];
            }
          }
        }

        // merge function name
        if (fn.name != '') {
          if (name == '') {
            name = fn.name;
          }
          else if (name != fn.name) {
            err = new Error('Function names do not match (expected: ' + name + ', actual: ' + fn.name + ')');
            err.data = {
              actual: fn.name,
              expected: name
            };
            throw err;
          }
        }
      });

      return _typed(name, signatures);
    }
  });

  // attach types and conversions to the final `typed` function
  typed.config = config;
  typed.types = types;
  typed.conversions = conversions;

  return typed;
}));


/**
 * typed-function
 *
 * Type checking for JavaScript functions
 *
 * https://github.com/josdejong/typed-function
 */
'use strict';

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
   * @param {number} argCount   Number of arguments
   * @param {Number} index      Current argument index
   * @param {*} actual          Current argument
   * @param {string} [expected] An optional, comma separated string with
   *                            expected types on given index
   * @extends Error
   */
  function createError(fn, argCount, index, actual, expected) {
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
      if (argCount > index && !anyType) {
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
          ' (expected: ' + index + ', actual: ' + argCount + ')'
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
      var _types = types.trim();
      var _varArgs = _types.substr(0, 3) === '...';
      if (_varArgs) {
        _types = _types.substr(3);
      }
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
   * Order Params
   * any type ('any') will be ordered last, and object as second last (as other
   * types may be an object as well, like Array).
   *
   * @param {Param} a
   * @param {Param} b
   * @returns {number} Returns 1 if a > b, -1 if a < b, and else 0.
   */
  Param.compare = function (a, b) {
    if (a.anyType) return 1;
    if (b.anyType) return -1;

    if (contains(a.types, 'Object')) return 1;
    if (contains(b.types, 'Object')) return -1;

    if (a.hasConversions()) {
      if (b.hasConversions()) {
        var ac = a.conversions.filter(function (conversion) {
          return conversion !== undefined;
        })[0];
        var bc = b.conversions.filter(function (conversion) {
          return conversion !== undefined;
        })[0];
        return typed.conversions.indexOf(ac) - typed.conversions.indexOf(bc);
      }
      else {
        return 1;
      }
    }
    else {
      if (b.hasConversions()) {
        return -1;
      }
    }

    return 0;
  };

  /**
   * Test whether this parameters types overlap an other parameters types.
   * @param {Param} other
   * @return {boolean} Returns true when there are conflicting types
   */
  Param.prototype.overlapping = function (other) {
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
        if (param.varArgs) {
          // a variable argument. do not split the types in the parameter
          var newParam = param.clone();

          // add conversions to the parameter
          // recurse for all conversions
          typed.conversions.forEach(function (conversion) {
            if (!contains(param.types, conversion.from) && contains(param.types, conversion.to)) {
              var i = newParam.types.length;
              newParam.types[i] = conversion.from;
              newParam.conversions[i] = conversion;
            }
          });

          recurse(signature, path.concat(newParam));
        }
        else {
          // split each type in the parameter
          param.types.forEach(function (type) {
            recurse(signature, path.concat(new Param(type)));
          });

          // recurse for all conversions
          typed.conversions.forEach(function (conversion) {
            if (!contains(param.types, conversion.from) && contains(param.types, conversion.to)) {
              var newParam = new Param(conversion.from);
              newParam.conversions[0] = conversion;
              recurse(signature, path.concat(newParam));
            }
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
   * Compare two signatures.
   *
   * When two params are equal and contain conversions, they will be sorted
   * by lowest index of the first conversions.
   *
   * @param {Signature} a
   * @param {Signature} b
   * @returns {number} Returns 1 if a > b, -1 if a < b, and else 0.
   */
  Signature.compare = function (a, b) {
    if (a.params.length > b.params.length) return 1;
    if (a.params.length < b.params.length) return -1;

    // count the number of conversions
    var ac = a.params.filter(function (param) {
      return param.hasConversions();
    });
    var bc = b.params.filter(function (param) {
      return param.hasConversions();
    });

    if (ac.length > bc.length) return 1;
    if (ac.length < bc.length) return -1;

    // compare the conversion index per parameter
    for (var i = 0; i < a.params.length; i++) {
      var cmp = Param.compare(a.params[i], b.params[i]);
      if (cmp !== 0) {
        return cmp;
      }
    }

    return 0;
  };

  /**
   * Test whether any of the signatures parameters has conversions
   * @return {boolean} Returns true when any of the parameters contains
   *                   conversions.
   */
  Signature.prototype.hasConversions = function () {
    return this.params.some(function (param) {
      return param.hasConversions();
    });
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
   * @param {Node | undefined} [anyType]  Sibling of this node with any type parameter
   * @returns {string} Returns the code as string
   */
  Node.prototype.toCode = function (refs, prefix, anyType) {
    // TODO: split this function in multiple functions, it's too large
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
          code.push(prefix + '      throw createError(\'\', arguments.length, i, arguments[i], \'' + allTypes.join(',') + '\');');
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
          code.push(this._innerCode(refs, prefix, anyType));
        }
        else {
          // regular type
          var type = this.param.types[0];
          var test = type !== 'any' ? refs.add(getTypeTest(type), 'test') : null;

          code.push(prefix + 'if (' + test + '(arg' + index + ')) { ' + comment);
          code.push(this._innerCode(refs, prefix + '  ', anyType));
          code.push(prefix + '}');
        }
      }
    }
    else {
      // root node (path is empty)
      code.push(this._innerCode(refs, prefix, anyType));
    }

    return code.join('\n');
  };

  /**
   * Generate inner code for this group of signatures.
   * This is a helper function of Node.prototype.toCode
   * @param {Refs} refs
   * @param {string} prefix
   * @param {Node | undefined} [anyType]  Sibling of this node with any type parameter
   * @returns {string} Returns the inner code as string
   * @private
   */
  Node.prototype._innerCode = function(refs, prefix, anyType) {
    var code = [];

    if (this.signature) {
      code.push(prefix + 'if (arguments.length === ' + this.path.length + ') {');
      code.push(this.signature.toCode(refs, prefix + '  '));
      code.push(prefix + '}');
    }

    var nextAnyType = this.childs.filter(function (child) {
      return child.param.anyType;
    })[0];

    this.childs.forEach(function (child) {
      code.push(child.toCode(refs, prefix, nextAnyType));
    });

    if (anyType && !this.param.anyType) {
      code.push(anyType.toCode(refs, prefix, nextAnyType));
    }

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
        prefix + '  throw createError(\'\', arguments.length, ' + index + ', arguments[' + index + ']);',
        prefix + '}'
      ].join('\n');
    }
    else {
      var types = this.childs.reduce(function (types, node) {
        node.param && node.param.types.forEach(function (type) {
          if (types.indexOf(type) === -1) {
            types.push(type);
          }
        });

        return types;
      }, []);

      return prefix + 'throw createError(\'\', arguments.length, ' + index + ', arguments[' + index + '], \'' + types.join(',') + '\');';
    }
  };

  /**
   * Split all raw signatures into an array with expanded Signatures
   * @param {Object.<string, function>} rawSignatures
   * @return {Signature[]} Returns an array with expanded signatures
   */
  function parseSignatures(rawSignatures) {
    var map = Object.keys(rawSignatures)
        .reduce(function (signatures, types) {
          var fn = rawSignatures[types];
          var signature = new Signature(types, fn);

          signature.expand().forEach(function (signature) {
            var key = signature.toString();
            if (signatures[key] === undefined) {
              signatures[key] = signature;
            }
            else {
              var cmp = Signature.compare(signature, signatures[key]);
              if (cmp < 0) {
                // override if sorted first
                signatures[key] = signature;
              }
              else if (cmp === 0) {
                throw new Error('Signature "' + key + '" is defined twice');
              }
              // else: just ignore
            }
          });

          return signatures;
        }, {});

    // convert from map to array
    var arr = Object.keys(map).map(function (types) {
      return map[types];
    });

    // filter redundant conversions from signatures with varArgs
    // TODO: simplify this loop or move it to a separate function
    arr.forEach(function (signature) {
      if (signature.varArgs) {
        var index = signature.params.length - 1;
        var param = signature.params[index];

        var t = 0;
        while (t < param.types.length) {
          if (param.conversions[t]) {
            var type = param.types[t];
            var exists = arr.some(function (other) {
              var p = other.params[index];

              return other !== signature && p &&
                  contains(p.types, type) &&   // FIXME: mutable variable warning
                  !p.conversions[index];
            });

            if (exists) {
              param.types.splice(t, 1);
              param.conversions.splice(t, 1);
              t--;
            }
          }
          t++;
        }
      }
    });

    return arr;
  }

  /**
   * create a map with normalized signatures as key and the function as value
   * @param {Signature[]} signatures   An array with split signatures
   * @return {Object.<string, function>} Returns a map with normalized
   *                                     signatures as key, and the function
   *                                     as value.
   */
  function mapSignatures(signatures) {
    return signatures.reduce(function (normalized, signature) {
      var params = signature.params.join(',');
      if (signature.fn) {
        normalized[params] = signature.fn;
      }
      return normalized;
    }, {});
  }

  /**
   * Parse signatures recursively in a node tree.
   * @param {Signature[]} signatures  Array with expanded signatures
   * @param {Param[]} path            Traversed path of parameter types
   * @return {Node}                   Returns a node tree
   */
  function parseTree(signatures, path) {
    var index = path.length;

    // filter the signatures with the correct number of params
    var signature = signatures.filter(function (signature) {
      return signature.params.length === index;
    })[0]; // there can be only one signature

    // recurse over the signatures
    var childs = signatures
        .filter(function (signature) {
          return signature.params[index] != undefined;
        })
        .sort(function (a, b) {
          return Param.compare(a.params[index], b.params[index]);
        })
        .reduce(function (entries, signature) {
          // group signatures with the same param at current index
          var param = signature.params[index];
          var existing = entries.filter(function (entry) {
            return entry.param.overlapping(param);
          })[0];

          if (existing) {
            if (existing.param.varArgs) {
              throw new Error('Conflicting types "' + existing.param + '" and "' + param + '"');
            }
            existing.signatures.push(signature);
          }
          else {
            entries.push({
              param: param,
              signatures: [signature]
            });
          }

          return entries;
        }, [])
        .map(function (entry) {
          return parseTree(entry.signatures, path.concat(entry.param))
        });

    return new Node(path, signature, childs);
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
      throw new Error('No signatures provided');
    }

    // parse signatures into a node tree
    var node = parseTree(_signatures, []);

    //var util = require('util');
    //console.log('ROOT');
    //console.log(util.inspect(node, { depth: null }));

    // generate code for the typed function
    var code = [];
    var _name = name || '';
    var _args = getArgs(maxParams(_signatures));
    code.push('function ' + _name + '(' + _args.join(', ') + ') {');
    code.push('  "use strict";');
    code.push(node.toCode(refs, '  '));
    code.push('}');

    // generate body for the factory function
    var body = [
      refs.toCode(),
      'return ' + code.join('\n')
    ].join('\n');

    // evaluate the JavaScript code and attach function references
    var factory = (new Function(refs.name, 'createError', body));
    var fn = factory(refs, createError);

    //console.log('FN\n' + fn.toString()); // TODO: cleanup

    // attach the signatures with sub-functions to the constructed function
    fn.signatures = mapSignatures(_signatures);

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
      if (types.hasOwnProperty(type) && type !== 'Object') {
        // Array and Date are also Object, so test for Object afterwards
        if (types[type](x)) return type;
      }
    }
    if (types['Object'](x)) return type;
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
              err = new Error('Signature "' + signature + '" is defined twice');
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

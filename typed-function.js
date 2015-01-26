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
    // OldNode. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like OldNode.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.typed = factory();
  }
}(this, function () {
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

    if (a.types.indexOf('Object') !== -1) return 1;
    if (b.types.indexOf('Object') !== -1) return -1;

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
      this.types = types.split('|').map(function (type) {
        return type.trim();
      });
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

    // parse variable arguments operator (ellipses '...number')
    if (this.types[0] !== undefined && this.types[0].substring(0, 3) == '...') {
      this.types[0] = this.types[0].substring(3) || 'any';
      this.varArgs = true;
    }
    else {
      this.varArgs = varArgs || false;
    }

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
  Param.prototype.conflictingTypes = function (other) {
    return this.types.some(function (type) {
      return other.types.indexOf(type) !== -1;
    });
  };

  /**
   * Create a clone of this param
   * @returns {Param} A cloned version of this param
   */
  Param.prototype.clone = function () {
    return new Param(this.types.slice(), this.varArgs);
  };

  /**
   * Return a string representation of this params types, like 'string' or
   * 'number | boolean' or '...number'
   * @returns {string}
   */
  Param.prototype.toString = function () {
    return (this.varArgs ? '...' : '') + this.types.join('|');
  };

  /**
   * A function signature
   * @param {string | string[]} params  Array with the type(s) of each parameter,
   *                                    or a comma separated string with types
   * @param {function} fn               The actual function
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

    // can hold a type to which to convert when calling this signature
    this.conversions = [];

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
   * Expand a signature:
   * - split params with multiple types in separate signatures
   * - expand signatures for every conversion
   * For example split a Signature "string | number" into two signatures.
   * @return {Signature[]} Returns an array with signatures (at least one)
   */
  Signature.prototype.expand = function () {
    var signatures = [];

    function _iterate(signature, types, index) {
      if (index < signature.params.length) {
        var param = signature.params[index];
        if (index == signature.params.length - 1 && signature.varArgs) {
          // last parameter of a varArgs signature. Do not split the varArgs parameter
          _iterate(signature, types.concat(param), index + 1);
        }
        else {
          param.types.forEach(function (type) {
            _iterate(signature, types.concat(new Param(type, param.varArgs)), index + 1);
          });
        }
      }
      else {
        signatures.push(new Signature(types, signature.fn));
      }
    }
    _iterate(this, [], 0);

    // TODO: expand conversions

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
      return param.varArgs ? 'varArgs' : ('arg' + index);
    }).join(', ');
    var ref = this.fn ? refs.add(this.fn, 'signature') : undefined;
    if (ref) {
      return prefix + 'return ' + ref + '(' + args  + '); // signature: ' + this.params.join(', ');
    }

    return code.join('\n');
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
      var comment = '// type: ' + this.param;

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
          var getTests = function (arg) {
            return this.param.types
                .map(function (type) {
                  return refs.add(getTypeTest(type), 'test') + '(' + arg + ')';
                })
                .join(' || ');
          }.bind(this);

          code.push(prefix + 'if (' + getTests('arg' + index) + ') { ' + comment);
          code.push(prefix + '  var varArgs = [arg' + index + '];');
          code.push(prefix + '  for (var i = ' + (index + 1) + '; i < arguments.length; i++) {');
          code.push(prefix + '    if (' + getTests('arguments[i]') + ') {');
          code.push(prefix + '      varArgs.push(arguments[i]);');
          code.push(prefix + '    } else {');
          code.push(prefix + '      throw ' + refs.add(unexpectedType, 'err') +
              '(\'' + this.param.types.join(',') + '\', arguments[i], i); // Unexpected type');
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
    var code = [];
    var index = this.path.length;

    if (this.childs.length === 0) {
      // no childs
      code.push(prefix + 'if (arguments.length > ' + index + ') {');
      code.push(prefix + '  throw ' + refs.add(tooManyArguments, 'err') +
          '(' + index + ', arguments.length); ' +
          '// Too many arguments');
      code.push(prefix + '}');
    }
    else {
      var arg = 'arg' + index;
      var types = this.childs.reduce(function (types, node) {
        // TODO: filter non-converted types
        return node.param ? types.concat(node.param.types) : types;
      }, []);

      // TODO: add "Actual: ..." to the error message
      code.push(prefix + 'if (arguments.length === ' + index + ') {');
      code.push(prefix + '  throw ' + refs.add(tooFewArguments, 'err') +
          '(\'' + types.join(',') + '\', arguments.length); ' +
          '// Too few arguments');
      code.push(prefix + '}');
      code.push(prefix + 'else {');
      code.push(prefix + '  throw ' + refs.add(unexpectedType, 'err') +
          '(\'' + types.join(',') + '\', ' + arg + ', ' + index + '); ' +
          '// Unexpected type');
      code.push(prefix + '}');
    }

    return code.join('\n');
  };

  /**
   * A node is used to create a node tree to recursively traverse parameters
   * of a function. Nodes have either:
   * - Child nodes in a map `types`.
   * - No child nodes but a function `fn`, the function to be called for 
   *   This signature.
   * @param {Param} type   The parameter type of this node
   * @param {OldNode | RootNode} parent
   * @constructor
   */
  function OldNode (type, parent) {
    this.parent = parent;
    this.type = type;
    this.fn = null;
    this.varArgs = false; // true if variable args '...'
    this.childs = {};
  }

  /**
   * Calculates the maximum depth (level) of nested childs
   * @return {number} Returns the maximum depth (zero if no childs, one if
   *                  it has childs without childs, etc)
   */
  OldNode.prototype.depth = function () {
    var level = 0;
    Object.keys(this.childs).forEach(function (type) {
      var childLevel = this.childs[type].depth() + 1;
      level = Math.max(level, childLevel);
    }.bind(this));

    return level;
  };

  /**
   * Test recursively whether this OldNode or any of it's childs need conversions
   */
  OldNode.prototype.hasConversions = function () {
    if (this._getConversions().length > 0) {
      return true;
    }
    if (this.type && this.type.varArgs && this._getVarArgConversions().length > 0) {
      return true;
    }

    if (this.childs) {
      for (var type in this.childs) {
        if (this.childs.hasOwnProperty(type)) {
          if (this.childs[type].hasConversions()) {
            return true;
          }
        }
      }
    }

    return false;
  };

  /**
   * Returns a string with JavaScript code for this function
   *
   * @param {{refs: Refs, args: string[], types: Param[], tests: string[], prefix: string, conversions: boolean, exceptions: boolean}} params
   * @param {{from: string, to: string, convert: function}} [conversion]
   *
   * Where:
   *   {Refs} refs            Object to store function references
   *   {string[]} args        Argument names, like ['arg0', 'arg1', ...],
   *                          but can also contain conversions like ['arg0', 'convert1(arg1)']
   *   {Param[]} types        Array with parameter types parsed so far
   *   {string[]} tests       Type tests, like ['test0', 'test2', ...]
   *   {string} prefix        A number of spaces to prefix for every line of code
   *   {boolean} conversions  A boolean which is true when the generated
   *                          code must do type conversions
   *   {boolean} exceptions   A boolean which is true when the generated code
   *                          must throw exceptions when there is no signature match
   *
   * @returns {string} code
   *
   * @protected
   */
  OldNode.prototype._toCode = function (params, conversion) {
    var code = [];

    var prefix = params.prefix;
    var ref = this.fn ? params.refs.add(this.fn, 'signature') : undefined;
    var arg = this.varArgs ? 'varArgs' : ('arg' + params.args.length);
    var type = this.type;

    var test;
    var nextArg;
    var convert;
    if (conversion) {
      test = params.refs.add(getTypeTest(conversion.from), 'test');
      convert = params.refs.add(conversion.convert, 'convert');
      nextArg = (type.varArgs === false) ? (convert + '(' + arg + ')') : arg;
    }
    else {
      test = (type.anyType === false) ? params.refs.add(getTypeTest(type.types[0]), 'test') : '';
      convert = null;
      nextArg = arg;
    }
    var comment = '// type: ' + (convert ? (conversion.from + ', convert to ' + type) : type);

    var args = params.args.concat(nextArg);
    var types = params.types.concat(type);
    var tests = params.tests.concat(test);
    var nextParams = merge(params, {
      args: args,
      types: types,
      tests: tests
    });

    if (this.varArgs) {
      // varArgs cannot have childs, it's the last argument
      if (type.anyType) {
        if (ref) {
          code.push(prefix + 'if (arguments.length >= ' + args.length + ') {');
          code.push(prefix + '  var varArgs = [];');
          code.push(prefix + '  for (var i = ' + (args.length - 1) + '; i < arguments.length; i++) {');
          code.push(prefix + '    varArgs.push(arguments[i]);');
          code.push(prefix + '  }');
          code.push(prefix + '  return ' + ref + '(' + args.join(', ') + '); // signature: ' + types.join(', '));
          code.push(prefix + '}');
          // TODO: throw Exception
        }
      }
      else {
        if (ref) {
          var varTests = function (tests, arg) {
            return tests
                .map(function (type) {
                  var test = params.refs.add(getTypeTest(type), 'test');
                  return test + '(' + arg + ')';
                })
                .join(' || ');
          };

          // collect all types (exact types and conversions, excluding types
          // handled by node's siblings)
          var allTests = this._getVarArgConversions()
              .map(function (conversion) {
                return conversion.from;
              })
              .concat(type.types);

          code.push(prefix + 'if (' + varTests(allTests, 'arg' + params.args.length) + ') {');
          code.push(prefix + '  var varArgs = [];');
          code.push(prefix + '  for (var i = ' + (args.length - 1) + '; i < arguments.length; i++) {');
          code.push(prefix + '    if (' + varTests(type.types, 'arguments[i]') + ') { // type: ' + type.types.join(' or '));
          code.push(prefix + '      varArgs.push(arguments[i]);');

          // iterate over all type conversions (including types handled by this node's siblings)
          if (params.conversions) {
            this._getVarArgConversions().forEach(function (conversion) {
              var test = params.refs.add(getTypeTest(conversion.from), 'test');
              var convert = params.refs.add(conversion.convert, 'convert');
              var comment = '// type: ' + conversion.from + ', convert to ' + conversion.to;

              code.push(prefix + '    }');
              code.push(prefix + '    else if (' + test + '(arguments[i])) { ' + comment);
              code.push(prefix + '      varArgs.push(' + convert + '(arguments[i]));');
            }.bind(this));
          }

          code.push(prefix + '    } else {');

          if (params.exceptions) {
            var err = params.refs.add(unexpectedType, 'err');
            code.push(prefix + '      throw ' + err + '(\'' + this.type.types + '\', arguments[i], i); // Unexpected type');
          }

          code.push(prefix + '    }');
          code.push(prefix + '  }');
          code.push(prefix + '  return ' + ref + '(' + args.join(', ') + '); // signature: ' + types.join(', '));
          code.push(prefix + '}');
        }
      }
    }
    else {
      if (type.anyType) {
        // any type (ordered last)
        code.push(this._innerCode(nextParams));
      }
      else {
        code.push(prefix + 'if (' + test + '(' + arg + ')) { ' + comment);
        code.push(this._innerCode(merge(nextParams, {prefix: prefix + '  '})));
        code.push(prefix + '}');
      }
    }

    return code.join('\n');
  };

  /**
   * Sub function of OldNode.prototype._toNode
   *
   * @param {{refs: Refs, args: string[], types: Param[], tests: string[], prefix: string, conversions: boolean, exceptions: boolean}} params
   * @param {Object} [childParams]  An object with the same properties as params.
   *                                If provided, `childParams` will be passed
   *                                to the childs instead of `params`.
   *
   * Where:
   *   {Refs} refs            Object to store function references
   *   {string[]} args        Argument names, like ['arg0', 'arg1', ...],
   *                          but can also contain conversions like ['arg0', 'convert1(arg1)']
   *                          Must include the arg of the current node.
   *   {Param[]} types        Array with parameter types parsed so far
   *                          Must include the type of the current node.
   *   {string[]} tests       Type tests, like ['test0', 'test2', ...]
   *                          Must include the test of the current node.
   *   {string} prefix        A number of spaces to prefix for every line of code
   *   {boolean} conversions  A boolean which is true when the generated
   *                          code must do type conversions
   *   {boolean} exceptions   A boolean which is true when the generated code
   *                          must throw exceptions when there is no signature match
   *
   * @returns {string} code
   *
   * @protected
   */
  OldNode.prototype._innerCode = function (params, childParams) {
    var code = [];
    var prefix = params.prefix;
    var ref = this.fn ? params.refs.add(this.fn, 'signature') : undefined;

    if (ref) {
      code.push(prefix + 'if (arguments.length === ' + params.args.length + ') {');
      code.push(prefix + '  return ' + ref + '(' + params.args.join(', ') + '); // signature: ' + params.types.join(', '));
      code.push(prefix + '}');
    }

    // iterate over the childs
    this._getChilds().forEach(function (child) {
      code.push(child._toCode(childParams || params));
    });

    // handle conversions
    if (params.conversions) {
      code = code.concat(this._conversionsToCode(params));
    }

    // handle exceptions
    if (params.exceptions) {
      code.push(this._exceptions(params));
    }

    return code.join('\n');
  };

  /**
   * Create an unsupported type error
   * @param {string} expected    String with comma separated types
   * @param {*} actual           The actual argument
   * @param {number} index       Index of the argument
   * @returns {TypeError} Returns a TypeError
   */
  function unexpectedType (expected, actual, index) {
    var arr = expected.split(',');
    var message = 'Unexpected type of argument';
    var actualType = getTypeOf(actual);
    var err = new TypeError(message + ' (expected: ' + arr.join(' or ') + ', actual: ' + actualType + ', index: ' + index + ')');
    err.data = {
      message: message,
      expected: arr,
      actual: actual,
      index: index
    };
    return err;
  }

  /**
   * Create a too-few-arguments error
   * @param {string} expected    String with comma separated types
   * @param {number} index       index of the argument
   * @returns {TypeError} Returns a TypeError
   */
  function tooFewArguments(expected, index) {
    var arr = expected.split(',');
    var message = 'Too few arguments';
    var err = new TypeError(message + ' (expected: ' + arr.join(' or ') + ', index: ' + index + ')');
    err.data = {
      message: message,
      expected: arr,
      index: index
    };
    return err;
  }

  /**
   * Create an too-many-arguments error
   * @param {number} expected  The expected number of arguments
   * @param {number} actual    The actual number of arguments
   * @returns {TypeError}Returns a TypeError
   */
  function tooManyArguments(expected, actual) {
    var message = 'Too many arguments';
    var err = new TypeError(message + ' (expected: ' + expected + ', actual: ' + actual + ')');
    err.data = {
      message: message,
      expected: expected,
      actual: actual
    };
    return err;
  }
  /**
   * Create code to throw an error
   *
   * @param {{refs: Refs, args: string[], types: Param[], tests: string[], prefix: string, conversions: boolean, exceptions: boolean}} params
   *
   * Where:
   *   {Refs} refs            Object to store function references
   *   {string[]} args        Argument names, like ['arg0', 'arg1', ...],
   *                          but can also contain conversions like ['arg0', 'convert1(arg1)']
   *                          Must include the arg of the current node.
   *   {Param[]} types        Array with parameter types parsed so far
   *                          Must include the type of the current node.
   *   {string[]} tests       Type tests, like ['test0', 'test2', ...]
   *                          Must include the test of the current node.
   *   {string} prefix        A number of spaces to prefix for every line of code
   *   {boolean} conversions  A boolean which is true when the generated
   *                          code must do type conversions
   *   {boolean} exceptions   A boolean which is true when the generated code
   *                          must throw exceptions when there is no signature match
   *
   * @returns {string} Code throwing an error
   *
   * @private
   */
  OldNode.prototype._exceptions = function (params) {
    var code = [];
    var prefix = params.prefix;
    var argCount = params.args.length;
    var arg = 'arg' + params.args.length;

    var types = Object.keys(this.childs);
    var typeNames = types
        .reduce(function (typeNames, type) {
          var child = this.childs[type];
          return typeNames.concat(child.type.types);
        }.bind(this), []);

    var firstChild = types.length > 0 ? this.childs[types[0]] : undefined;
    if (firstChild && firstChild.varArgs) {
      // variable arguments
      code.push(prefix + 'if (arguments.length === ' + argCount + ') {');
      code.push(prefix + '  throw ' + params.refs.add(tooFewArguments, 'err') +
          '(\'' + typeNames.join(',') + '\', arguments.length); // Too few arguments');
      code.push(prefix + '} else {');
      code.push(prefix + '  throw ' + params.refs.add(unexpectedType, 'err') +
          '(\'' + typeNames.join(',') + '\', ' + arg + ', ' + argCount + '); // Unexpected type');
      code.push(prefix + '}');
    }
    else if (types.length === 0) {
      // no childs
      code.push(prefix + 'if (arguments.length > ' + argCount + ') {');
      code.push(prefix + '  throw ' + params.refs.add(tooManyArguments, 'err') +
          '(' + argCount + ', arguments.length); // Too many arguments');
      code.push(prefix + '}');
    }
    else if (types.indexOf('any') !== -1) {
      // any type
      code.push(prefix + 'throw ' + params.refs.add(tooFewArguments, 'err') +
      '(\'any\', arguments.length); // Too few arguments');
    }
    else {
      // regular type
      // TODO: add "Actual: ..." to the error message
      code.push(prefix + 'if (arguments.length === ' + argCount + ') {');
      code.push(prefix + '  throw ' + params.refs.add(tooFewArguments, 'err') +
      '(\'' + typeNames.join(',') + '\', arguments.length); // Too few arguments');
      code.push(prefix + '}');
      code.push(prefix + 'else {');
      code.push(prefix + '  throw ' + params.refs.add(unexpectedType, 'err') +
      '(\'' + typeNames.join(',') + '\', ' + arg + ', ' + argCount + '); // Unexpected type');
      code.push(prefix + '}');
    }

    return code.join('\n');
  };

  /**
   * Create a code representation for iterating over conversions
   *
   * @param {{refs: Refs, args: string[], types: Param[], tests: string[], prefix: string, conversions: boolean, exceptions: boolean}} params
   *
   * Where:
   *   {Refs} refs            Object to store function references
   *   {string[]} args        Argument names, like ['arg0', 'arg1', ...],
   *                          but can also contain conversions like ['arg0', 'convert1(arg1)']
   *   {Param[]} types        Array with parameter types parsed so far
   *   {string[]} tests       Type tests, like ['test0', 'test2', ...]
   *   {string} prefix        A number of spaces to prefix for every line of code
   *   {boolean} conversions  A boolean which is true when the generated
   *                          code must do type conversions
   *   {boolean} exceptions   A boolean which is true when the generated code
   *                          must throw exceptions when there is no signature match
   *
   * @returns {string[]} Returns an array with code lines
   *
   * @protected
   */
  OldNode.prototype._conversionsToCode = function (params) {
    var code = [];

    // iterate over conversions from this node's own type to any of its siblings type
    if (this.parent) {
      code.push(params.prefix + '// PARENT ' + (params.args.length - 1) + ' ' + Object.keys(this.parent.childs))
      this.parent._getChilds().forEach(function (child) {
        var conversion = typed.conversions.filter(function (conversion) {
          return this.type.toString() == conversion.from && child.type == conversion.to.toString();
        }.bind(this))[0];

        if (conversion) {
          var arg = 'arg' + (params.args.length - 1);
          var test = params.refs.add(getTypeTest(conversion.from), 'test');
          var convert = params.refs.add(conversion.convert, 'convert');
          var nextArg = convert + '(' + arg + ')';
          var comment = '// convert arg' + (params.args.length - 1) + ' from ' + conversion.from + ' to ' + conversion.to;

          var args  = params.args.slice(0, params.args.length - 1).concat(nextArg);
          var types = params.args.slice(0, params.types.length - 1).concat(child.type);
          var nextParams = merge(params, {
            args: args,
            types: types
          });

          // iterate over the childs
          code.push(params.prefix + comment);
          child._getChilds().forEach(function (grantChild) {
            code.push(grantChild._toCode(nextParams));
          });
          //code = code.concat(child._conversionsToCode(nextParams)); // TODO:
        }
      }.bind(this));
    }

    // iterate over the type conversions which are not dealt with by child nodes
    this._getConversions().forEach(function (conversion) {
          var type = conversion.to;
          var child = this.childs[type];

          code.push(child._toCode(params, conversion));
        }.bind(this));

    return code;
  };

  /**
   * Get the childs of this node ordered by type
   * @return {OldNode[]} Returns an array with Nodes
   * @protected
   */
  OldNode.prototype._getChilds = function () {
    return Object.keys(this.childs)
        .map(function (type) {
          return this.childs[type];
        }.bind(this))
        .sort(function (a, b) {
          return compareParams(a.type, b.type);
        })
  };

  /**
   * Get the conversions relevant for this OldNode
   * @returns {Array} Array with conversion objects
   * @protected
   */
  OldNode.prototype._getConversions = function () {
    // if there is a varArgs child, there is no need to do conversions separately,
    // that is handled by the varArg loop
    var hasVarArgs = this._getChilds().some(function (child) {
      return child.type.varArgs;
    });
    if (hasVarArgs) {
      return [];
    }

    // filter the relevant type conversions
    var handled = {};
    return typed.conversions
        .filter(function (conversion) {
          if (this.childs[conversion.from] === undefined &&
              this.childs[conversion.to] !== undefined &&
              !handled[conversion.from]) {
            handled[conversion.from] = true;
            return true;
          }
          else {
            return false;
          }
        }.bind(this));
  };

  /**
   * Get the conversions relevant for a OldNode with variable arguments
   * @returns {Array} Array with conversion objects
   * @protected
   */
  OldNode.prototype._getVarArgConversions = function () {
    // filter the relevant type conversions
    var handled = {};
    return typed.conversions
        .filter(function (conversion) {
          if (this.type.types.indexOf(conversion.from) === -1 &&
              this.type.types.indexOf(conversion.to) !== -1 &&
              !this.parent.childs[conversion.from] &&
              !handled[conversion.from]) {
            handled[conversion.from] = true;
            return true;
          }
          else {
            return false;
          }
        }.bind(this))
  };

  /**
   * The root node of a node tree
   * @param {string} [name]         Optional function name
   * @constructor
   */
  function RootNode(name) {
    this.name = name || '';
    this.fn = null;
    this.childs = {};
  }

  RootNode.prototype = Object.create(OldNode.prototype);

  /**
   * Returns a string with JavaScript code for this function
   * @param {Refs} refs     Object to store function references
   * @return {string} code
   */
  RootNode.prototype.toCode = function (refs) {
    var code = [];

    // create an array with all argument names
    var argCount = this.depth();
    var args = [];
    for (var i = 0; i < argCount; i++) {
      args[i] = 'arg' + i;
    }

    // check whether the function at hand needs conversions
    var hasConversions = this.hasConversions();

    // function begin
    code.push('return function ' + this.name + '(' + args.join(', ') + ') {');

    // function signature with zero arguments
    var ref = this.fn ? refs.add(this.fn, 'signature') : undefined;
    if (ref) {
      code.push('  if (arguments.length === 0) {');
      code.push('    return ' + ref + '(); // signature: (empty)');
      code.push('  }');
    }

    var params = {
      refs: refs,
      args: [],
      types: [],
      tests: [],
      prefix: '  '
    };

    // matches
    code.push(this._getChilds().map(function (child) {
      return child._toCode(merge(params, {
        conversions: true,
        exceptions: true
      }));
    }).join('\n'));

    // FIXME: variable any type argument matching all argument types instead of the left over types not defined by other signatures.

    // conversions
    if (hasConversions) {
      code = code.concat(this._conversionsToCode(merge(params, {
        conversions: true,
        exceptions: true
      })));
    }

    // function end
    code.push(this._exceptions(params));
    code.push('}');

    return code.join('\n');
  };

  /**
   * Split all raw signatures into an array with (split) Signatures
   * @param {Object.<string, function>} rawSignatures
   * @return {Signature[]} Returns an array with split signatures
   */
  function parseSignatures(rawSignatures) {
    return Object.keys(rawSignatures).reduce(function (signatures, params) {
      var fn = rawSignatures[params];
      var signature = new Signature(params, fn);

      return signatures.concat(signature.expand());
    }, []);
  }

  /**
   * create a map with normalized signatures as key and the function as value
   * @param {Signature[]} signatures   An array with split signatures
   * @return {Object} Returns a map with normalized signatures
   */
  function normalizeSignatures(signatures) {
    var normalized = {};

    signatures.map(function (entry) {
      var signature = entry.params.join(',');
      normalized[signature] = entry.fn;
    });

    return normalized;
  }

  /**
   * Parse signatures recursively in a node tree.
   * @param {Signature[]} signatures   An array with signatures
   * @param {Param[]} params           Path with parameters to this node
   * @return {Node}                    Returns a node tree
   */
  function parseTree(signatures, params) {
    var index = params.length;

    // filter the signatures with the correct number of params
    var withFn = signatures.filter(function (signature) {
      return signature.params.length === index;
    });
    var signature = withFn.shift();
    if (withFn.length > 0) {
      throw new Error('Signature "' + signature.params + '" defined multiple times');
    }

    // recurse over the signatures
    var childs = signatures
        .filter(function (signature) {
          return signature.params[index] != undefined;
        })
        .sort(function (a, b) {
          return compareParams(a.params[index], b.params[index]);
        })
        .reduce(function (entries, signature) {
          // group signatures with the same param at current index
          var existing = entries.filter(function (entry) {
            return entry.param.equalTypes(signature.params[index])
          })[0];

          if (existing) {
            existing.signatures.push(signature);
          }
          else {
            entries.push({
              param: signature.params[index],
              signatures: [signature]
            });
          }
          return entries;
        }, [])
        .map(function (entry) {
          return parseTree(entry.signatures, params.concat(entry.param))
        });

    return new Node(params, signature, childs);
  }

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
    var longest = _signatures.reduce(function (a, b) {
      return !b ? a : (a.params.length >= b.params.length ? a : b);
    });
    var _args = getArgs(longest && longest.params.length || 0);
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

    //console.log('FN\n' + fn.toString()); // TODO: cleanup

    // attach the signatures with sub-functions to the constructed function
    fn.signatures = normalizeSignatures(_signatures); // normalized signatures

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


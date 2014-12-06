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
  // anytype (*) will be ordered last, and object as second last (as other types
  // may be an object as well, like Array)
  function compareTypes(a, b) {
    if (a === '*') return 1;
    if (b === '*') return -1;

    if (a === 'Object') return 1;
    if (b === 'Object') return -1;

    return 0;
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
   * @param {boolean} [variable=false]           Variable arguments if true
   * @constructor
   */
  function Param(types, variable) {
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

    // parse variable arguments operator (ellipses '...')
    this.variable = variable || false;
    this.types.forEach(function (type, index) {
      if (type.substring(type.length - 3) == '...') {
        if (index === this.types.length - 1) {
          this.types[index] = type.substring(0, type.length - 3);
          this.variable = true;
        }
        else {
          // TODO: allow variable arguments anywhere? (similar to optional args like `fn(string?, string, function)`
          throw new SyntaxError('Unexpected variable arguments operator "..."');
        }
      }
    }.bind(this));
  }

  /**
   * Create a clone of this param
   * @returns {Param} A cloned version of this param
   */
  Param.prototype.clone = function () {
    return new Param(this.types.slice(), this.variable);
  };

  /**
   * Return a string representation of this params types, like 'string' or
   * 'number | boolean'
   * @returns {string}
   */
  Param.prototype.toString = function () {
    return this.types.join('|');
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
    
    // check variable arguments operator '...'
    var withVarArgs = this.params.filter(function (param) {
      return param.variable;
    });
    if (withVarArgs.length === 0) {
      this.variable = false;
    }
    else if (withVarArgs[0] === this.params[this.params.length - 1]) {
      this.variable = true;
    }
    else {
      throw new SyntaxError('Unexpected variable arguments operator "..."');
    }

    this.fn = fn;
  }

  /**
   * Split params with multiple types in separate signatures,
   * for example split a Signature "string | number" into two signatures.
   * @return {Signature[]} Returns an array with signatures (at least one)
   */
  Signature.prototype.split = function () {
    var signatures = [];

    function _iterate(signature, types, index) {
      if (index < signature.params.length) {
        var param = signature.params[index];
        param.types.forEach(function (type) {
          _iterate(signature, types.concat(new Param(type, param.variable)), index + 1);
        });
      }
      else {
        signatures.push(new Signature(types, signature.fn));
      }
    }
    _iterate(this, [], 0);

    return signatures;
  };

  /**
   * A node is used to create a node tree to recursively traverse parameters
   * of a function. Nodes have either:
   * - Child nodes in a map `types`.
   * - No child nodes but a function `fn`, the function to be called for 
   *   This signature.
   * @param {string[]} [signature]   An optional array with types of the
   *                                 signature up to this child node.
   * @constructor
   */
  function Node (signature) {
    this.signature = signature || [];
    this.fn = null;
    this.variable = false;
    this.childs = {};
  }

  /**
   * Calculates the maximum depth (level) of nested childs
   * @return {number} Returns the maximum depth (zero if no childs, one if
   *                  it has childs without childs, etc)
   */
  Node.prototype.depth = function () {
    var level = 0;
    Object.keys(this.childs).forEach(function (type) {
      var childLevel = this.childs[type].depth() + 1;
      level = Math.max(level, childLevel);
    }.bind(this));

    return level;
  };

  /**
   * Returns a string with JavaScript code for this function
   * @param {Refs} refs     Object to store function references
   * @param {string[]} args Argument names, like ['arg0', 'arg1', ...],
   *                        but can also contain conversions like ['arg0', 'convert1(arg1)']
   * @param {string} prefix A number of spaces to prefix for every line of code
   * @return {string} code
   */
  Node.prototype.toCode = function (refs, args, prefix) {
    var code = [];
    var childs = this.childs;

    if (this.fn !== null) {
      var ref = refs.add(this.fn, 'signature');

      if(this.variable) {
        code.push(prefix + 'if (arguments.length > ' + (args.length - 1) + ') {');
        code.push(prefix + '  return ' + ref + '(' + args.join(', ') + '); // signature: ' + this.signature + '...');
        code.push(prefix + '}');
      }
      else {
        code.push(prefix + 'if (arguments.length === ' + args.length +') {');
        code.push(prefix + '  return ' + ref + '(' + args.join(', ') + '); // signature: ' + this.signature);
        code.push(prefix + '}');
      }
    }

    // add entries for the provided childs
    Object.keys(childs)
        .sort(compareTypes)
        .forEach(function (type) {
          var arg = 'arg' + args.length;
          var child = childs[type];

          if (type == '*') { // anytype (this type is ordered last)
            if (child.variable) {
              code.push(prefix + 'var varArgs = [];');
              code.push(prefix + 'for (var i = ' + args.length + '; i < arguments.length; i++) {');
              code.push(prefix + '  varArgs.push(arguments[i]);');
              code.push(prefix + '}');
              code.push(child.toCode(refs, args.concat('varArgs'), prefix));
            }
            else {
              code.push(child.toCode(refs, args.concat(arg), prefix));
            }
          }
          else {
            var test = refs.add(getTypeTest(type), 'test');

            if (child.variable) {
              code.push(prefix + 'var match = true;');
              code.push(prefix + 'var varArgs = [];');
              code.push(prefix + 'for (var i = ' + args.length + '; i < arguments.length; i++) {');
              code.push(prefix + '  if (' + test + '(arguments[i])) {');
              code.push(prefix + '    varArgs.push(arguments[i]);');
              code.push(prefix + '  } else {');
              code.push(prefix + '    match = false;');
              code.push(prefix + '    break;');
              code.push(prefix + '  }');
              code.push(prefix + '}');
              code.push(prefix + 'if (match) {');
              code.push(child.toCode(refs, args.concat('varArgs'), prefix + '  '));
              code.push(prefix + '}');

              // TODO: conversion of arguments
            }
            else {
              code.push(prefix + 'if (' + test + '(' + arg + ')) { // type: ' + type);
              code.push(child.toCode(refs, args.concat(arg), prefix + '  '));
              code.push(prefix + '}');
            }
          }
        });

    // add entries for type conversions
    var added = {};
    typed.conversions
        .filter(function (conversion) {
          return childs[conversion.to] && !childs[conversion.from];
        })
        .forEach(function (conversion) {
          if (!added[conversion.from]) {
            added[conversion.from] = true;

            var arg = 'arg' + args.length;
            var test = refs.add(getTypeTest(conversion.from), 'test') + '(' + arg + ')';
            var convert = refs.add(conversion.convert, 'convert') + '(' + arg + ')';

            code.push(prefix + 'if (' + test + ') { // type: ' + conversion.from + ', convert to ' + conversion.to);
            code.push(childs[conversion.to].toCode(refs, args.concat(convert), prefix + '  '));
            code.push(prefix + '}');
          }
        });

    return code.join('\n');
  };

  /**
   * The root node of a node tree
   * @param {string} [name]         Optional function name
   * @constructor
   */
  function RootNode(name) {
    this.name = name || '';
    this.signature = [];
    this.fn = null;
    this.childs = {};
  }

  RootNode.prototype = Object.create(Node.prototype);

  RootNode.prototype._toCode = Node.prototype.toCode;

  /**
   * Returns a string with JavaScript code for this function
   * @param {Refs} refs     Object to store function references
   * @return {string} code
   */
  RootNode.prototype.toCode = function (refs) {
    var code = [];

    // create an array with all argument names
    var argCount = this.depth();
    var params = [];
    for (var i = 0; i < argCount; i++) {
      params[i] = 'arg' + i;
    }

    var args = [];
    var prefix = '  ';
    code.push('return function ' + this.name + '(' + params.join(', ') + ') {');
    code.push(this._toCode(refs, args, prefix));
    code.push('  throw new TypeError(\'Wrong function signature\');');  // TODO: output the actual signature
    code.push('}');
    
    return code.join('\n');
  };
  
  /**
   * Split all raw signatures into an array with (split) Signatures
   * @param {Object.<string, function>} rawSignatures
   * @return {Signature[]} Returns an array with split signatures
   */
  function splitSignatures(rawSignatures) {
    return Object.keys(rawSignatures).reduce(function (signatures, params) {
      var fn = rawSignatures[params];
      var signature = new Signature(params, fn);

      return signatures.concat(signature.split());
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
      if (signature in normalized) {
        throw new Error('Error: signature "' + signature + '" defined twice');
      }
      normalized[signature] = entry.fn;
    });

    return normalized;
  }

  /**
   * Create a recursive node tree for traversing the number and type of parameters
   * @param {string} [name]            Function name. Optional
   * @param {Signature[]} signatures   An array with split signatures
   * @return {RootNode}                Returns a node tree
   */
  function createNodeTree(name, signatures) {
    var root = new RootNode(name);

    signatures.forEach(function (signature) {
      var params = signature.params.concat([]);

      // loop over all parameters, create a nested structure
      var node = root;
      while(params.length > 0) {
        var param = params.shift();
        var type = param.types[0];

        var child = node.childs[type];
        if (child === undefined) {
          child = node.childs[type] = new Node(node.signature.concat(type));
        }
        node = child;
      }

      // add the function as leaf of the innermost node
      node.fn = signature.fn;
      node.variable = signature.variable;
    });

    return root;
  }

  /**
   * Minify JavaScript code of a typed function
   * @param {string} code
   * @return {string} Returns (roughly) minified code
   */
  function minify (code) {
    return code
        .replace(/\/\/.*/g, '')     // remove comments
        .replace(/\s*\n\s*/gm, '') // remove spaces and returns
        .replace(/ \{/g, '{')     // other whitespaces
        .replace(/ \(/g, '(')     // other whitespaces
        .replace(/(signature|test|convert|arg)(?=\d)/g, function (v) {
          // replace long variable names like 'signature1' with their first letter 's1'
          return v.charAt(0);
        });
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

    // parse signatures, create a node tree
    var structure = splitSignatures(signatures);
    var tree = createNodeTree(name, structure);

    //console.log('TREE', JSON.stringify(tree, null, 2)) // TODO: cleanup

    var treeCode = tree.toCode(refs); // TODO: do not create references in toCode but in createNodeTree
    var refsCode = refs.toCode();

    // generate JavaScript code
    var factory = [
      '(function (' + refs.name + ') {',
      refsCode,
      treeCode,
      '})'
    ].join('\n');

    //console.log('FACTORY', factory) // TODO: cleanup

    if (typed.config.minify) {
      factory = minify(factory);
    }

    // evaluate the JavaScript code and attach function references
    var fn = eval(factory)(refs);

    // attach the signatures with sub-functions to the constructed function
    fn.signatures = normalizeSignatures(structure); // normalized signatures

    return fn;
  }

  // data type tests
  var types = {
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

  // configuration
  var config = {
    minify: true
  };

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
      return _typed(null, signatures);
    },
    'string, string, function': function(name, signature, fn) {
      var signatures = {};
      signatures[signature] = fn;
      return _typed(name, signatures);
    }
  });

  // attach types and conversions to the final `typed` function
  typed.config = config;
  typed.types = types;
  typed.conversions = conversions;

  return typed;
}));


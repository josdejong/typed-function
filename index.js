'use strict';

// order types
// object will be ordered last as other types may be an object too.
function compareTypes(a, b) {
  return a === 'object' ? 1 : b === 'object' ? -1 : 0
}

// order numbers
function compareNumbers(a, b) {
  return a > b;
}

// replace all words in a string
function replaceWord(text, match, replacement) {
  return text.replace(/\w*/g, function (word) {
    return word == match ? replacement : word
  });
}

function inlineFunction(fn, param) {
  var str = fn.toString();

  var match = /\((\w*)\)\s*{\s*("use strict";)?\s*return\s*(.*)}/.exec(str);
  var arg = match && match[1];
  var body = match && match[3];

  if (arg && body) {
    return body.replace(/\w*/g, function (word) {
      return word == arg ? param : word
    });
  }
  else {
    // no inlining possible, return a self invoking function.
    console.log('WARNING: failed to inline function ' + str + '. ' +
        'This works fine but costs a little performance');
    return null;
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

  var normalized = {};  // normalized function signatures
  var defs = {};        // function definitions (local shortcuts to functions)

  // analise all signatures
  var argumentCount = 0;
  var parameters = {};
  Object.keys(signatures).forEach(function (signature) {
    var fn = signatures[signature];
    var params = (signature !== '') ? signature.split(',').map(function (param) {
      return param.trim();
    }) : [];
    var normSignature = params.join(',');
    normalized[normSignature] = fn;
    argumentCount = Math.max(argumentCount, params.length);

    // get the entry for this number of arguments
    var obj = parameters[params.length];
    if (!obj) {
      obj = parameters[params.length] = {
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

  //console.log('parameters', JSON.stringify(parameters, null, 2)); // TODO: cleanup

  function switchTypes(signature, args, prefix) {
    var code = [];

    if (signature.fn !== null) {
      code.push(prefix + 'return signatures[\'' + signature.signature + '\'](' + args.join(', ') +');');
    }
    else {
      // add entries for the provided types
      Object.keys(signature.types)
          .sort(compareTypes)
          .forEach(function (type) {
            if (!compose.tests[type]) {
              throw new Error('Unknown type "' + type + '"');
            }
            var arg = 'arg' + args.length;
            //var test = inlineFunction(compose.tests[type], arg);
            var test = 'tests[\'' + type + '\'](' + arg + ')';

            code.push(prefix + 'if (' + test +') {');
            code = code.concat(switchTypes(signature.types[type], args.concat(arg), prefix + '  '));
            code.push(prefix + '}');
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

              if (!compose.tests[conversion.from]) {
                throw new Error('Unknown type "' + conversion.from + '"');
              }
              var arg = 'arg' + args.length;
              var convertedArg = replaceWord(conversion.equation, 'x', arg);
              //var test = inlineFunction(compose.tests[conversion.from], arg);
              var test = 'tests[\'' + conversion.from + '\'](' + arg + ')';

              code.push(prefix + 'if (' + test +') {');
              code = code.concat(switchTypes(signature.types[conversion.to], args.concat(convertedArg), prefix + '  '));
              code.push(prefix + '}');
            }
          });

    }

    return code;
  }

  var args = [];
  for (var i = 0; i < argumentCount; i++) {
    args.push('arg' + i);
  }

  var counts = Object.keys(parameters);
  var code = [];
  code.push('(function (type, signatures, tests, conversions) {');
  code.push('return function ' + (name || '') + '(' + args.join(', ') + ') {');

  // create if statements checking the number of arguments
  counts
      .sort(compareNumbers)
      .forEach(function (count, index) {
        var signature = parameters[count];
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
  code.push( '})');

  var fn = eval(code.join('\n'))(compose.tests.type, normalized, compose.tests, compose.conversions);

  // attach the original functions
  fn.signatures = normalized;

  return fn;
}

// data type tests
compose.tests = {
  'null':     function (x) {return x === null},
  'boolean':  function (x) {return typeof x === 'boolean'},
  'number':   function (x) {return typeof x === 'number'},
  'string':   function (x) {return typeof x === 'string'},
  'function': function (x) {return typeof x === 'function'},
  'array':    function (x) {return Array.isArray(x)},
  'date':     function (x) {return x instanceof Date},
  'regexp':   function (x) {return x instanceof RegExp},
  'object':   function (x) {return typeof x === 'object'}
};

// type conversions
// order is important
// TODO: replace equations with functions
compose.conversions = [];

module.exports = compose;

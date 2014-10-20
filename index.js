'use strict';

exports.type = function(x) {
  var type = typeof x;

  if (type === 'object') {
    if (x === null)           return 'null';
    if (Array.isArray(x))     return 'array';
    if (x instanceof Date)    return 'date';
    if (x instanceof Function)return 'function';
    if (x instanceof RegExp)  return 'regexp';

    // These should not be used in practice
    if (x instanceof Boolean) return 'boolean';
    if (x instanceof Number)  return 'number';
    if (x instanceof String)  return 'string';
  }

  return type;
};

var types = {
  'boolean': 'typeof x === \'boolean\'',
  'number': 'typeof x === \'number\'',
  'string': 'typeof x === \'string\'',
  'function': 'typeof x === \'function\'',
  'null': 'x === null',
  'object': 'typeof x === \'object\'', // Important: object must be checked last, as may types are an Object too
  'array': 'Array.isArray(x)',
  'date': 'x instanceof Date',
  'regexp': 'x instanceof RegExp'
};

// order types such that 'object' is last
function compareTypes(a, b) {
  return a === 'object' ? 1 : b === 'object' ? -1 : 0
}

// order numbers
function compareNumbers(a, b) {
  return a > b;
}

/**
 * Compose a function from sub-functions each handling a single type signature.
 * @param {Object.<string, function>} functions
 *            A map with the type signature as key and the sub-function as value
 * @return {function} Returns the composed function
 */
function compose(functions) {
  // TODO: add support for named functions

  var normFunctions = {};

  // analise all signatures
  var argumentCount = 0;
  var parameters = {};
  Object.keys(functions).forEach(function (signature) {
    var fn = functions[signature];
    var params = (signature !== '') ? signature.split(',').map(function (param) {
      return param.trim();
    }) : [];
    var normSignature = params.join(',');
    normFunctions[normSignature] = fn;
    argumentCount = Math.max(argumentCount, params.length);

    // get the entry for this number of arguments
    if (!parameters[params.length]) {
      parameters[params.length] = {
        signature: [],
        fn: null,
        types: {}
      };
    }
    var obj = parameters[params.length];

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
    if (signature.fn !== null) {
      return prefix + 'return signatures[\'' + signature.signature + '\'](' + args.join(', ') +');\n';
    }
    else {
      return Object.keys(signature.types)
          .sort(compareTypes)
          .map(function (type) {
            if (!types[type]) {
              throw new Error('Unknown type "' + type + '"');
            }

            var arg = 'arg' + args.length;
            var test = types[type].replace(/\w*/g, function (word) {
              return word == 'x' ? arg : word
            });

            return prefix + 'if (' + test +') {\n' +
                switchTypes(signature.types[type], args.concat('arg' + args.length), prefix + '  ') +
                prefix + '}\n';
          })
          .join('');
    }
  }

  var args = [];
  for (var i = 0; i < argumentCount; i++) {
    args.push('arg' + i);
  }

  var counts = Object.keys(parameters);
  var code = '(function (type, signatures) {\n' +
      'return function (' + args.join(', ') + ') {\n' +
      counts
          .sort(compareNumbers)
          .map(function (count, index) {
            var signature = parameters[count];
            var args = [];
            var statement = (index == 0) ? 'if' : 'else if';
            return '  ' + statement + ' (arguments.length == ' + count +  ') {\n' +
                switchTypes(signature, args, '    ') +
                '  }\n' +
                ((index == counts - 1) ? ('  else {\n' +
                '    throw new TypeError(\'Wrong number of arguments\');\n' + // TODO: output the allowed numbers
                '  }\n') : '');
          })
          .join('') +
      '  throw new TypeError(\'Wrong function signature\');\n' + // TODO: output the actual signature
      '}\n' +
      '})\n';

  //console.log('code', code); // TODO: cleanup

  var fn = eval(code)(types.type, normFunctions);

  //console.log('fn', fn.toString()) // TODO: cleanup

  // attach the original functions
  fn.signatures = normFunctions;

  return fn;
}

// expose all types (you can add more)
compose.types = types;

module.exports = compose;

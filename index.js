'use strict';

// data type tests
compose.types = {
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

// type conversions
compose.conversions = [
  {from: 'boolean', to: 'number', conversion: '+x'},
  {from: 'boolean', to: 'string', conversion: 'x+\'\''},
  {from: 'number',  to: 'string', conversion: 'x+\'\''}
];

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
 * @param {string} [name]  An optional name for the function
 * @param {Object.<string, function>} functions
 *            A map with the type signature as key and the sub-function as value
 * @return {function} Returns the composed function
 */
function compose(name, functions) {
  // TODO: add support for named functions
  if (!functions) {
    functions = name;
    name = null;
  }

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
      Object.keys(signature.types)
          .sort(compareTypes)
          .forEach(function (type) {
            if (!compose.types[type]) {
              throw new Error('Unknown type "' + type + '"');
            }

            var arg = 'arg' + args.length;
            var test = compose.types[type].replace(/\w*/g, function (word) {
              return word == 'x' ? arg : word
            });

            code.push(prefix + 'if (' + test +') {');
            code = code.concat(switchTypes(signature.types[type], args.concat('arg' + args.length), prefix + '  '));
            code.push(prefix + '}');
          })
    }

    return code;
  }

  var args = [];
  for (var i = 0; i < argumentCount; i++) {
    args.push('arg' + i);
  }

  var counts = Object.keys(parameters);
  var code = [];
  code.push('(function (type, signatures) {');
  code.push('return function ' + (name || '') + '(' + args.join(', ') + ') {');

  counts
      .sort(compareNumbers)
      .forEach(function (count, index) {
        var signature = parameters[count];
        var args = [];
        var statement = (index == 0) ? 'if' : 'else if';
        code.push('  ' + statement + ' (arguments.length == ' + count +  ') {');
        code = code.concat(switchTypes(signature, args, '    '));

        code.push('  }');
        if (index == counts - 1) {
          code.push('  else {');
          code.push('    throw new TypeError(\'Wrong number of arguments\');'); // TODO: output the allowed numbers
          code.push('  }');
        }
      });
  code.push('  throw new TypeError(\'Wrong function signature\');');  // TODO: output the actual signature
  code.push('}');
  code.push( '})');

  //console.log('code', code.join('\n')); // TODO: cleanup

  var fn = eval(code.join('\n'))(compose.types.type, normFunctions);

  //console.log('fn', fn.toString()) // TODO: cleanup

  // attach the original functions
  fn.signatures = normFunctions;

  return fn;
}

module.exports = compose;

'use strict';

// data type tests
compose.tests = {
  'null': 'x === null',
  'boolean': 'typeof x === \'boolean\'',
  'number': 'typeof x === \'number\'',
  'string': 'typeof x === \'string\'',
  'function': 'typeof x === \'function\'',
  'array': 'Array.isArray(x)',
  'date': 'x instanceof Date',
  'regexp': 'x instanceof RegExp',
  'object': 'typeof x === \'object\''
};

// type conversions. Order is important!
compose.conversions = [
  {from: 'boolean', to: 'number', equation: '+x'},
  {from: 'boolean', to: 'string', equation: 'x + \'\''},
  {from: 'number',  to: 'string', equation: 'x + \'\''}
];

// order types
// object must be ordered last as other types may be an object too.
function compareTypes(a, b) {
  return a === 'object' ? 1 : b === 'object' ? -1 : 0
}

// order numbers
function compareNumbers(a, b) {
  return a > b;
}

function A() {}

console.log(['number', 'object', 'boolean', 'a'].sort(compareTypes))


// replace all words in a string
function replaceWord(text, match, replacement) {
  return text.replace(/\w*/g, function (word) {
    return word == match ? replacement : word
  });
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
      var addedConversions = {}; // to keep track of the type conversions already added

      Object.keys(signature.types)
          .sort(compareTypes)
          .forEach(function (type) {
            if (!compose.tests[type]) {
              throw new Error('Unknown type "' + type + '"');
            }

            var arg = 'arg' + args.length;
            var test = replaceWord(compose.tests[type], 'x', arg);

            code.push(prefix + 'if (' + test +') {');
            code = code.concat(switchTypes(signature.types[type], args.concat(arg), prefix + '  '));
            code.push(prefix + '}');

            // add entries for type conversions
            compose.conversions
                .filter(function (conversion) {
                  return conversion.to == type &&
                      !signature.types[conversion.from] &&
                      !addedConversions[conversion.from];
                })
                .forEach(function (conversion) {
                  addedConversions[conversion.from] = true;
                  if (!compose.tests[conversion.from]) {
                    throw new Error('Unknown type "' + conversion.from + '"');
                  }
                  var test = replaceWord(compose.tests[conversion.from], 'x', 'arg' + args.length);
                  var arg  = replaceWord(conversion.equation, 'x', 'arg' + args.length);

                  code.push(prefix + 'if (' + test +') {');
                  code = code.concat(switchTypes(signature.types[type], args.concat(arg), prefix + '  '));
                  code.push(prefix + '}');
                });
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
  code.push('(function (type, signatures) {');
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

  var fn = eval(code.join('\n'))(compose.tests.type, normFunctions);

  // attach the original functions
  fn.signatures = normFunctions;

  return fn;
}

module.exports = compose;

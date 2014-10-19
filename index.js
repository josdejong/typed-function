'use strict';

var types = require('./lib/types');

/**
 * Compose a function from sub-functions each handling a single type signature.
 * @param {Object.<string, function>} functions
 *            A map with the type signature as key and the sub-function as value
 * @return {function} Returns the composed function
 */
function compose(functions) {
  // TODO: add support for named functions

  var normFunctions = {};

  // TODO: instead of nested switches, do a direct lookup in a flat map. Only problem is how to handle any type arguments *


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

  console.log('parameters', JSON.stringify(parameters, null, 2)); // TODO: cleanup
  console.log();

  function switchTypes(signature, args) {
    if (signature.fn !== null) {
      return 'return functions[\'' + signature.signature + '\'](' + args.join(', ') +');\n';
    }
    else {
      return 'switch(type(arg' + args.length + ')) {\n' +
          Object.keys(signature.types).map(function (type) {
            return 'case \'' + type + '\':\n' +
                switchTypes(signature.types[type], args.concat('arg' + args.length)) +
                'break;\n';
          }).join('') +
          'default:\n' +
          'throw new TypeError(type(arg' + args.length + ') + \' not supported\');\n' +
          '}\n';
    }
  }

  var args = [];
  for (var i = 0; i < argumentCount; i++) {
    args.push('arg' + i);
  }

  // TODO: test if we can improve the performance by creating local variables pointing to the actual functions
  var code = '(function (type, functions) {\n' +
      'return function (' + args.join(',') + ') {\n' +
      'switch(arguments.length) {\n' +
      Object.keys(parameters).map(function (count) {
        var signature = parameters[count];
        var args = [];
        return 'case ' + count + ':\n' + switchTypes(signature, args) + ' break;\n';
      }).join('') +
      'default: throw new TypeError(\'Wrong number of arguments\');\n' + // TODO: change this into an ArgumentsError?
      '}\n' +
      '}\n' +
      '})\n';

  console.log('code', code); // TODO: cleanup

  var fn = eval(code)(types.type, normFunctions);

  // attach the original functions
  fn.signatures = normFunctions;

  return fn;
}

module.exports = compose;

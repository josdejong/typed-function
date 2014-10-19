'use strict';

var types = require('./lib/types');

function signatureName (signature) {
  // TODO: rename in case of multiple args
  return 'fn' + signature;
}

/**
 * Compose a function from sub-functions each handling a single type signature.
 * @param {Object.<string, function>} functions
 *            A map with the type signature as key and the sub-function as value
 * @return {function} Returns the composed function
 */
function compose(functions) {
  // TODO: get the parameter names and max number of parameters

  // analise all signatures
  var signatures = Object.keys(functions);



  // TODO: test if we can improve the performance by creating local variables pointing to the functions

  var code = '(function (type, functions) {\n' +
      'return function (arg0) {\n' +
      'switch(type(arg0)) {\n' +
      signatures.map(function (signature) {
        return 'case \'' + signature + '\': return functions[\'' + signature + '\'](arg0); break;\n';
      }).join('') +
      'default: throw new TypeError(type(arg0) + \' not supported\');\n' +
      '}\n' +
      '}\n' +
      '})\n';

  var fn = eval(code)(types.type, functions);

  // attach the original functions
  fn.signatures = functions;

  return fn;
}

module.exports = compose;

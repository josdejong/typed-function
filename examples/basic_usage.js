var typed = require('../typed-function');

// create a typed function
var fn = typed('number, *', function (a, b) {
  return 'a is a number, b can be anything';
});

// use the function
console.log(fn(2, true));      // outputs 'a is a number, b can be anything'

// calling the function with a non-supported type signature will throw an error
try {
  fn('hello world', true);
}
catch (err) {
  console.log(err.toString()); // outputs: 'TypeError: Wrong function signature'
}

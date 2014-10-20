var compose = require('../index');

// compose a new function
var fn = compose({
  'number': function (a) {
    return 'a is a number';
  },
  'number, boolean': function (a, b) {
    return 'a is a number, b is a boolean';
  },
  'number, number': function (a, b) {
    return 'a is a number, b is a number';
  }
});

// use the function
console.log(fn(2, true));      // outputs 'a is a number, b is a boolean'
console.log(fn(2));            // outputs 'a is a number'

// calling the function with a non-supported type signature will throw an error
try {
  fn('hello world');
}
catch (err) {
  console.log(err.toString()); // outputs: 'TypeError: Wrong function signature'
}

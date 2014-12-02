var typed = require('../typed-function');

typed.config.minify = false;

// create a typed function with a variable number of arguments
var sum = typed('number...', function (values) {
  var sum = 0;
  for (var i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum;
});

console.log(sum.toString());

// use the typed function
console.log(sum(2, 3));         // output: 5
console.log(sum(2, 3, 1, 2));   // output: 8

var compose = require('../index');

var I_MAX = 1e6;

function benchmark(name, test) {
  var start = +new Date();

  var repetitions = test();

  var end = +new Date();
  var duration = end - start;

  console.log(name + ': ' + repetitions.toExponential() + ' calls, ' +
      Math.round(duration) + ' ms, ' +
      parseFloat((duration / repetitions).toPrecision(4)).toExponential() + ' ms per call');

  return {
    repetitions: repetitions,
    duration: duration
  };
}


var count = 0;
function direct() {
  var args = Array.prototype.slice.apply(arguments);
  args.forEach(function (arg) {
    count = count + (arg && arg.length) ? arg.length : 1;
  });
  return count;
}
var composed = compose({
  'number': direct,
  'number,boolean': direct,
  'number,number': direct,
  'number,date': direct,
  'string': direct,
  'string,boolean': direct
});

console.log(composed.toString())

var directResult = benchmark('Direct', function () {
  var i, r, d = new Date();
  for (i = 0; i < I_MAX; i++) {
    r = direct(1, d);
    r = direct('hi', false);
    r = direct(2, 4);
  }

  return I_MAX * 3;
});

var composedResult = benchmark('Composed', function () {
  var i, r, d = new Date();
  for (i = 0; i < I_MAX; i++) {
    r = composed(1, d);
    r = composed('hi', false);
    r = composed(2, 4);
  }

  return I_MAX * 3;
});


var overhead = ((composedResult.duration - directResult.duration) / composedResult.repetitions);
console.log('Overhead: ' + parseFloat(overhead.toPrecision(4)).toExponential() + ' ms per call');

// Output on FireFox:
//    Direct: 3e+6 calls, 2219 ms, 7.397e-4 ms per call
//    Composed: 3e+6 calls, 2221 ms, 7.403e-4 ms per call
//    Overhead: 6.667e-7 ms per call

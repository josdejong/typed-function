// To create a bundle:
//
//     browserify -o benchmark/benchmark2.bundle.js benchmark/benchmark2.js

'use strict';

var assert = require('assert');
var Benchmark = require('benchmark');
var padRight = require('pad-right');
var typed1 = require('../typed-function');
var typed2 = require('../typed-function2');

// expose on window when using bundled in a browser
if (typeof window !== 'undefined') {
  window['Benchmark'] = Benchmark;
}

function add(x, y) {
  return x + y;
}

var signatures = {
  'number, number': add,
  'boolean, boolean': add,
  'Date, Date': add,
  'string, string': add
};

var add1 = typed1('add', signatures);
var add2 = typed2('add', signatures);

// console.log(add1.name, add1.signatures)
// console.log(add2.name, add2.signatures)

assert(add1(2,3), 5);
assert(add1('hello', 'world'), 'helloworld');
assert.throws(function () { add1(1) }, /TypeError/)
assert.throws(function () { add1(1,2,3) }, /TypeError/)
assert(add2(2,3), 5);
assert(add2('hello', 'world'), 'helloworld');
assert.throws(function () { add2(1) }, /TypeError/)
assert.throws(function () { add2(1,2,3) }, /TypeError/)

var result = 0;
var suite = new Benchmark.Suite();
suite
    .add(pad('add v1'), function() {
      result += add1(result, 4);
      result += add1(String(result), 'world').length;
    })
    .add(pad('add v2'), function() {
      result += add2(result, 4);
      result += add2(String(result), 'world').length;
    })
    .add(pad('direct'), function() {
      result += add(result, 4);
      result += add(String(result), 'world').length;
    })

    .on('cycle', function(event) {
      console.log(String(event.target));
    })
    .on('complete', function() {
      if (result > Infinity) {
        console.log()
      }
    })
    .run();

function pad (text) {
  return padRight(text, 20, ' ');
}

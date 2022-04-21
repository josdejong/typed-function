//
// typed-function benchmark
//
// WARNING: be careful, these are micro-benchmarks, which can only be used
//          to get an indication of the performance. Real performance and
//          bottlenecks should be assessed in real world applications,
//          not in micro-benchmarks.
//
// Before running, make sure you've installed the needed packages which
// are defined in the devDependencies of the project.
//
// To create a bundle for testing in a browser:
//
//     browserify -o benchmark/benchmark.bundle.js benchmark/benchmark.js
//
const assert = require('assert');
const Benchmark = require('benchmark');
const padRight = require('pad-right');
const typed = require('../typed-function');

// expose on window when using bundled in a browser
if (typeof window !== 'undefined') {
  window['Benchmark'] = Benchmark;
}

function vanillaAdd(x, y) {
  return x + y;
}

const typedAdd = typed('add', {
  'number, number': (x, y) => x + y,
  'boolean, boolean': (x, y) => x + y,
  'Date, Date': (x, y) => x + y,
  'string, string': (x, y) => x + y
});

assert.strictEqual(vanillaAdd(2,3), 5);
assert.strictEqual(typedAdd(2, 3), 5);
assert.strictEqual(typedAdd('hello', 'world'), 'helloworld');
assert.throws(function () { typedAdd(1) }, /TypeError/)
assert.throws(function () { typedAdd(1,2,3) }, /TypeError/)

const typed2 = createTyped(11, 10)

const typed1Signature0Conversions = createTyped1Signature0Conversions(typed2)
assert.strictEqual(typed1Signature0Conversions('Type0', 'Type0'), 'Result:Type0:Type0')

const typed10Signatures0Conversions = createTyped10Signatures0Conversions(typed2)
assert.strictEqual(typed10Signatures0Conversions('Type0', 'Type0'), 'Result:Type0:Type0')
assert.strictEqual(typed10Signatures0Conversions('Type7', 'Type7'), 'Result:Type7:Type7')

const typed1Signature10Conversions = createTyped1Signature10Conversions(typed2)
assert.strictEqual(typed1Signature10Conversions('Type0', 'Type0'), 'Result:Type0->TypeBase:Type0')
assert.strictEqual(typed1Signature10Conversions('Type7', 'Type0'), 'Result:Type7->TypeBase:Type0')

const typed10Signatures10Conversions = createTyped10Signatures10Conversions(typed2)
assert.strictEqual(typed10Signatures10Conversions('TypeBase', 'Type0'), 'Result:TypeBase:Type0')
assert.strictEqual(typed10Signatures10Conversions('Type7', 'Type0'), 'Result:Type7->TypeBase:Type0')
assert.strictEqual(typed10Signatures10Conversions('Type7', 'Type5'), 'Result:Type7->TypeBase:Type5')

const paramsCount = 20
const manyParams = Array(paramsCount).fill('Type0')
const typed1SignatureManyParams = createTyped1SignatureManyParams(typed2, paramsCount)
assert.strictEqual(typed1SignatureManyParams.apply(null, manyParams),'Result:' + manyParams.join(':'))

const suite = new Benchmark.Suite('typed-function');

let result = 0;
suite
  // compare vanilla vs typed execution
  .add(pad('execute: vanillaAdd'), function() {
    result += vanillaAdd(result, 4);
    result += vanillaAdd(String(result), 'world').length;
  })
  .add(pad('execute: typedAdd'), function() {
    result += typedAdd(result, 4);
    result += typedAdd(String(result), 'world').length;
  })

  // see execution time of various typed functions
  .add(pad('execute:  1 signature,   0 conversions'), function() {
    typed1Signature0Conversions('Type0', 'Type0')
  })
  .add(pad('execute: 10 signatures,  0 conversions'), function() {
    typed10Signatures0Conversions('Type0', 'Type0')
  })
  .add(pad('execute:  1 signatures, 10 conversions'), function() {
    typed1Signature10Conversions('Type0', 'Type0')
  })
  .add(pad('execute: 10 signatures, 10 conversions'), function() {
    typed10Signatures10Conversions('Type0', 'Type0')
  })
  .add(pad(`execute:  1 signature,  ${paramsCount} params`), function() {
    typed1SignatureManyParams.apply(null, manyParams)
  })

  // see creation time of various typed functions
  .add(pad('create:   1 signature,   0 conversions'), function() {
    createTyped1Signature0Conversions(typed2)
  })
  .add(pad('create:  10 signatures,  0 conversions'), function() {
    createTyped10Signatures0Conversions(typed2)
  })
  .add(pad('create:   1 signatures, 10 conversions'), function() {
    createTyped1Signature10Conversions(typed2)
  })
  .add(pad('create:  10 signatures, 10 conversions'), function() {
    createTyped10Signatures10Conversions(typed2)
  })
  .add(pad(`create:   1 signature,  ${paramsCount} params`), function() {
    createTyped1SignatureManyParams(typed2, paramsCount)
  })

  // run and output stuff
  .on('cycle', function(event) {
    console.log(String(event.target));
  })
  .on('complete', function() {
    console.log('First typed universe created', typed.createCount, 'functions')
    console.log('typed2 universe created', typed2.createCount, 'functions')
  })
  .run();

function createTyped1Signature0Conversions(typed) {
  return typed('1Signature', {
    'Type0,Type0': (a, b) => 'Result:' + a + ':' + b
  })
}

function createTyped10Signatures0Conversions(typed) {
  const count = 10

  const signatures = {}
  for (let t = 0; t < count; t++) {
    signatures[`Type${t}, Type${t}`] = (a, b) => 'Result:' + a + ':' + b
  }

  return typed('10Signatures', signatures)
}

function createTyped1Signature10Conversions(typed) {
  return typed('1Signature10conversions', {
    'TypeBase, Type0': (a, b) => 'Result:' + a + ':' + b
  })
}

function createTyped10Signatures10Conversions(typed) {
  const count = 10
  const signatures = {}
  for (let t = 0; t < count; t++) {
    signatures[`TypeBase, Type${t}`] = (a, b) => 'Result:' + a + ':' + b
  }

  return typed('10Signatures10conversions', signatures)
}

function createTyped1SignatureManyParams(typed, paramsCount) {
  const signatureStr = Array(paramsCount).fill('Type0')

  return typed(`1Signature${paramsCount}Params`, {
    [signatureStr]: (...args) => 'Result:' + args.join(':')
  })
}

function createTyped(typeCount, conversionCount) {
  const newTyped = typed.create()
  newTyped.types = []
  newTyped.conversions = []

  const baseName = 'TypeBase'
  newTyped.addType({
    name: baseName,
    test: function (value) {
      return typeof value === 'string' && value === baseName
    }
  })

  for (let t = 0; t < typeCount; t++) {
    const name = 'Type' + t

    newTyped.addType({
      name,
      test: function (value) {
        return typeof value === 'string' && value === name
      }
    })
  }

  for (let c = 0; c < conversionCount; c++) {
    newTyped.addConversion({
      from: 'Type' + c,
      to: baseName,
      convert: function (value) {
        return value + '->' + baseName;
      }
    })
  }

  return newTyped
}

function pad (text) {
  return padRight(text, 40, ' ');
}

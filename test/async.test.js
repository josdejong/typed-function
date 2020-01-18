var assert = require('assert');
var typed = require('../typed-function');

describe('async', function () {
  it('should add async support for one parameter', function () {
    var inc = typed({
      'number': function inc (value) {
        return value + 1;
      }
    }, { createAsync: true });
    assert.strictEqual(inc(2), 3);

    return inc(delayedValue(4)).then(asyncResult => {
      assert.strictEqual(asyncResult, 5);
    });
  });

  it('should not override defined async signatures', function () {
    var inc = typed({
      'number': function inc (value) {
        return value + 1;
      },
      'Promise': function () {
        return Promise.resolve(42);
      }
    }, { createAsync: true });

    return inc(delayedValue(2)).then(asyncResult => {
      assert.strictEqual(asyncResult, 42);
    });
  });

  it('should add async support for two parameters', function () {
    var add = typed({
      'number, number': function add (a, b) {
        return a + b
      }
    }, { createAsync: true });
    assert.strictEqual(add(2, 3), 5);

    return add(delayedValue(4), delayedValue(5, 1000))
      .then(asyncResult => {
        assert.strictEqual(asyncResult, 9);
      });
  });

  it('should have async support for mixed sync and async', function () {
    var add = typed({
      'number, number': function (a, b) {
        return a + b
      }
    }, { createAsync: true });

    return Promise.all([
      add(4, delayedValue(5)).then(asyncResult => {
        assert.strictEqual(asyncResult, 9);
      }),
      add(delayedValue(4), 7).then(asyncResult => {
        assert.strictEqual(asyncResult, 11);
      })
    ])
  });

  it('should add async support for rest parameter', function () {
    function add (a, b) {
      return a + b;
    }

    var sum = typed({
      '...number': function (args) {
        return args.reduce(add, 0)
      }
    }, { createAsync: true });
    assert.strictEqual(sum(2, 3, 4), 9);

    return sum(delayedValue(1), delayedValue(2, 100), delayedValue(3))
      .then(asyncResult => {
        assert.strictEqual(asyncResult, 6);
      });
  });
});

async function delayedValue (value, delay = 10) {
  const resolvedValue = await value; // in case result is a Promise
  await sleep(delay)
  return resolvedValue
}

function sleep (delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

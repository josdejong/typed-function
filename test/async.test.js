var assert = require('assert');
var typed = require('../typed-function');

describe('async', function () {

  before(function () {
    typed.conversions = [
      {from: 'boolean', to: 'number', convert: function (x) {return +x;}}
    ];
  });

  after(function () {
    // cleanup conversions
    typed.conversions = [];
  });

  it('should add async support for one parameter', function () {
    var inc = typed({
      'number': function inc (value) {
        return value + 1;
      }
    }, { createAsync: true });

    assert.strictEqual(inc(2), 3);
    assert.strictEqual(inc(true), 2);

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

  // FIXME: should add async support for any type and conversions
  it.skip('should add async support for any type and conversions', function () {
    var inc = typed({
      'number': function inc (value) {
        console.log('inc(number = ' + value+ ')')
        return value + 1;
      },
      'any': function inc (value) {
        console.log('inc(any = ' + value + ')')
        return 'inc(any=' + value + ')';
      }
    }, { createAsync: true });

    console.log('signatures', inc.signatures)

    // sync
    assert.strictEqual(inc(2), 3);
    assert.strictEqual(inc(true), 'inc(any=true)');
    assert.strictEqual(inc('2'), 'inc(any=2)');

    // async
    return Promise.all([
      inc(delayedValue(4)).then(asyncResult => {
        assert.strictEqual(asyncResult, 5);
      }),
      inc(delayedValue('4')).then(asyncResult => {
        assert.strictEqual(asyncResult, 'inc(any=4)');
      }),
      inc(delayedValue(true)).then(asyncResult => {
        assert.strictEqual(asyncResult, 'inc(any=true)');
      })
    ])
  });

  it('should add async support for two parameters', function () {
    var add = typed({
      'number, number': function add (a, b) {
        return a + b
      }
    }, { createAsync: true });
    assert.strictEqual(add(2, 3), 5);

    return add(delayedValue(4), delayedValue(5))
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

  it('should add async support for type conversions', function () {
    var inc = typed({
      'number': function inc (value) {
        return value + 1;
      }
    }, { createAsync: true });

    assert.strictEqual(inc(1), 2);
    assert.strictEqual(inc(true), 2);

    return Promise.all([
      inc(delayedValue(1)).then(asyncResult => {
        assert.strictEqual(asyncResult, 2);
      }),
      inc(delayedValue(true)).then(asyncResult => {
        assert.strictEqual(asyncResult, 2);
      })
    ]);
  });

  it('should have async support for mixed async and conversions', function () {
    var add = typed({
      'number, number': function (a, b) {
        return a + b
      }
    }, { createAsync: true });

    assert.strictEqual(add(2, 3), 5);
    assert.strictEqual(add(true, 3), 4);
    assert.strictEqual(add(3, true), 4);

    return Promise.all([
      add(true, delayedValue(5)).then(asyncResult => {
        assert.strictEqual(asyncResult, 6);
      }),
      add(delayedValue(true), 5).then(asyncResult => {
        assert.strictEqual(asyncResult, 6);
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

    return sum(delayedValue(1), 2, delayedValue(3))
      .then(asyncResult => {
        assert.strictEqual(asyncResult, 6);
      });
  });

  it('should add async support for rest parameter and conversions', function () {
    function add (a, b) {
      return a + b;
    }

    var sum = typed({
      '...number': function (args) {
        return args.reduce(add, 0)
      }
    }, { createAsync: true });
    assert.strictEqual(sum(2, true, 4), 7);

    return sum(2, delayedValue(true), 4)
      .then(asyncResult => {
        assert.strictEqual(asyncResult, 7);
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

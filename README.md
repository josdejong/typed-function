function-composer
=================

Compose functions with multiple type signatures.

Supported environments: node.js, Chrome, Firefox, Safari, Opera, IE9+.

# Load

Install via npm:

    npm install function-composer


# Usage

Example usage:

```js
var compose = require('function-composer');

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
```


# Roadmap

- Create named functions.
- Add new types (already possible but not yet documented)
- Automatic casting, for example from boolean to number.
- Extend function signatures:
  - Any type arguments like `'*, boolean'`.
  - Ellipsis like `'string, ...'`.
  - Optional arguments like `'number?, array'`.
- Create a good benchmark, to get insight in the overhead.
- Add a bundle for use in the browser.

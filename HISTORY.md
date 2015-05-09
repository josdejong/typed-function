# History

## not yet released, version 0.8.0

- Implemented function `create` to create a new instance of typed-function.
- Implemented a simple `typed.find` function to find the implementation of a
  specific function signature.
- Extended the error messages to denote the function name, like `"Too many 
  arguments in function foo (...)"`.


## 2015-04-17, version 0.7.0

- Performance improvements.


## 2015-03-08, version 0.6.3

- Fixed generated internal Signature and Param objects not being cleaned up
  after the typed function has been generated.


## 2015-02-26, version 0.6.2

- Fixed a bug sometimes not ordering the handling of any type arguments last.
- Fixed a bug sometimes not choosing the signature with the lowest number of
  conversions.


## 2015-02-07, version 0.6.1

- Large code refactoring.
- Fixed bugs related to any type parameters.


## 2015-01-16, version 0.6.0

- Removed the configuration option `minify`
  (it's not clear yet whether minifying really improves the performance).
- Internal code simplifications.
- Bug fixes.


## 2015-01-07, version 0.5.0

- Implemented support for merging typed functions.
- Typed functions inherit the name of the function in case of one signature.
- Fixed a bug where a regular argument was not matched when there was a
  signature with variable arguments too.
- Slightly changed the error messages.


## 2014-12-17, version 0.4.0

- Introduced new constructor options, create a typed function as
  `typed([name,] signature, fn)` or `typed([name,] signatures)`.
- Support for multiple types per parameter like `number | string, number'`.
- Support for variable parameters like `sting, ...number'`.
- Changed any type notation `'*'` to `'any'`.
- Implemented detailed error messages.
- Implemented option `typed.config.minify`.


## 2014-11-05, version 0.3.1

- Renamed module to `typed-function`.


## 2014-11-05, version 0.3.0

- Implemented support for any type arguments (denoted with `*`).


## 2014-10-23, version 0.2.0

- Implemented support for named functions.
- Implemented support for type conversions.
- Implemented support for custom types.
- Library packaged as UMD, usable with CommonJS (node.js), AMD, and browser globals.


## 2014-10-21, version 0.1.0

- Implemented support for functions with zero, one, or multiple arguments.


## 2014-10-19, version 0.0.1

- First release (no functionality yet)

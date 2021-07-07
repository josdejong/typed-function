/**
 * Tiny ESM to UMD converter for converting standalone js libraries
 * 
 * Expects the ESM to only contain one `export default` statement (no named exports)
 * Expects the ESM to not contain import statements
 * 
 * usage: cat some-lib.esm.js | node toUmd.js libNameToExportUnder > some-lib.js
 */

process.stdout.write(`(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // OldNode. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like OldNode.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    var g
    if (typeof globalThis !== 'undefined') {
      g = globalThis;
    } else if (typeof window !== 'undefined') {
      g = window;
    } else if (typeof global !== 'undefined') {
      g = global;
    } else if (typeof self !== 'undefined') {
      g = self;
    } else {
      g = root;
    }
    g[${JSON.stringify(process.argv[2])}] = factory();
  }
}(this, function () {
`);
process.stdin.setEncoding('utf8');


process.stdin.on('readable', function() {
  var chunk = process.stdin.read();

  if(chunk === null)
    return;

  process.stdout.write(chunk.replace(/^[ \t]*export default /mg, "return "));
});

process.stdin.on('end', function() {
  process.stdout.write("\n}));");
});
import typed from '../src/typed-function.mjs'

describe('security', function () {
  it('should not allow bad code in the function name', function () {
    // simple example:
    // var fn = typed("(){}+console.log('hacked...');function a", {
    //   "": function () {}
    // });

    // example resulting in throwing an error if successful
    typed("(){}+(function(){throw new Error('Hacked... should not have executed this function!!!')})();function a", {
      '': function () {}
    })
  })
})

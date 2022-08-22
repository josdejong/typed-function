const { strictEqual } = require('assert')
const cp = require('child_process')
const path = require('path')

describe('lib', () => {
  it('should load the library using ESM', (done) => {
    const filename = path.join(__dirname, 'apps/esmApp.mjs')

    cp.exec(`node ${filename}`, function (error, result) {
      strictEqual(error, null)
      strictEqual(result, 'a is a number, b is a string\n')
      done()
    })
  })

  it('should load the library using CJS (using dynamic import)', (done) => {
    const filename = path.join(__dirname, 'apps/cjsApp.cjs')

    cp.exec(`node ${filename}`, function (error, result) {
      strictEqual(error, null)
      strictEqual(result, 'a is a number, b is a string\n')
      done()
    })
  })
})

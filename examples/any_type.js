var compose = require('../function-composer');


// compose a function with anytype arguments
var log = compose({
  'string, *': function (event, data) {
    console.log('event: ' + event + ', data: ' + JSON.stringify(data));
  },
  '*': function (data) {
    console.log('data: ' + JSON.stringify(data));
  }
});

// use the composed function
log('start', {count: 2});   // output: 'event: start, data: {"count":2}'
log('some data');           // output: 'data: "some data"'

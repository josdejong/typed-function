var typed = require('../typed-function');

// create a typed function with an anytype argument '*'
var log = typed('string, *', function (event, data) {
    console.log('event: ' + event + ', data: ' + JSON.stringify(data));
  });

// use the typed function
log('start', {count: 2});   // output: 'event: start, data: {"count":2}'
log('end', 'success!');     // output: 'event: start, data: "success"

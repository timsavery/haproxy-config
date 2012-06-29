var haproxy = require('../index.js')
  , server1 = new haproxy.ListenerServer('server1', '127.0.0.1', {
  	port: 3001,
  	maxconn: 64
  })
  , server2 = new haproxy.ListenerServer('server2', '127.0.0.1', {
  	port: 3002,
  	maxconn: 64
  });

var listener = new haproxy.Listener('EchoService', { port: 3000 });
listener.servers[server1.name] = server1;
listener.servers[server2.name] = server2;

var config = new haproxy.Config();
config.listeners[listener.name] = listener;

config.save(function() {
	console.log('Configuration saved!');
});
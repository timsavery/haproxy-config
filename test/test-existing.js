var haproxy = require('../index.js');

haproxy.Config.load('.', function(err, config) {
	if (err) {
		throw Error(err);
	}
	
	config.save(function() {
		console.log('Configuration saved!');
	});
});
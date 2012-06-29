var fs = require('fs')
  , path = require('path')
  , async = require('async');

module.exports.Config = function() {
	var self = this;

	self.listeners = {};

	this.save = function(callback) {
		console.log('getting ready to save config');
		console.log('config = %s', JSON.stringify(self, null, 2));

		async.forEach(Object.keys(self.listeners), function(listener, callback) {
			self.listeners[listener].save(callback);
		}, function() {			
			var stream = fs.createWriteStream('haproxy.cfg');

			stream.on('open', function(fd) {
				stream.write('global\n');
				stream.write('  daemon\n');
				stream.write('  maxconn 256\n');
				stream.write('\n');
				stream.write('defaults\n');
				stream.write('  mode http\n');
				stream.write('  timeout connect 5000ms\n');
				stream.write('  timeout client 50000ms\n');
				stream.write('  timeout server 50000ms\n');
				stream.write('\n');

				Object.keys(self.listeners).forEach(function(listenerName) {					
					stream.write(self.listeners[listenerName].asConfigEntry());
				});

				if (callback) {
					callback();
				}
			});
		});		
	};
};

module.exports.Config.load = function(directory, callback) {
	fs.readdir('.', function(err, files) {
		if (err) {
			return callback({ message: 'Failed to read contents of directory "' + directory + '": ' + JSON.stringify(err) });
		}

		var config = new module.exports.Config();

		async.forEach(files, function(file, fileCallback) {			
			fs.stat(file, function(err, stats) {
				if (err) {
					return fileCallback({ message: 'Failed to stat file "' + file + '": ' + JSON.stringify(err) });
				}
				
				if (stats.isFile() && path.extname(file) == '.listener') {
					var listenerName = file.replace('.listener','');
					module.exports.Listener.load(listenerName, function(err, listener) {					
						if (err) {
							return fileCallback(err);
						} 
						config.listeners[listenerName] = listener;

						return fileCallback();
					});					
				} else {
					fileCallback();
				}
			});
		}, function(err) {
			callback(err, config);
		});
	});
};

module.exports.Listener = function(name, options) {
	var self = this
	  , options = options || {};

	self.name = name;
	self.port = options.port || 80;
	self.servers = options.servers || {};

	this.save = function(callback) {
		fs.writeFile('./' + this.name + '.listener', JSON.stringify({
			name: this.name,
			port: this.port,
			servers: this.servers
		}, null, 2), callback);
	};

	this.asConfigEntry = function() {
		var self = this;

		var configStr = 'listen ' + this.name + '\n';
		configStr += '  bind *:' + this.port + '\n';

		Object.keys(self.servers).forEach(function(serverName) {
			var server = self.servers[serverName];
			configStr += '  ' + server.asConfigEntry();
		});

		return configStr;
	}
};

module.exports.ListenerServer = function(name, host, options) {
	var self = this
	  , options = options || {};

	self.name = name;
	self.host = host;
	self.port = options.port || 80;
	self.maxconn = options.maxconn || 32;	

	this.asConfigEntry = function() {
		return 'server ' + self.name + ' ' + self.host + ':' + self.port + ' maxconn ' + self.maxconn + '\n';
	};
};

module.exports.Listener.load = function(name, callback) {
	var listenerFilePath = './' + name + '.listener';
	path.exists(listenerFilePath, function(exists) {
		if (exists) {
			fs.readFile(listenerFilePath, 'utf8', function(err, contents) {
				if (err) {
					return callback({ message: 'Failed to load file ' + listenerFilePath + ': ' + JSON.stringify(err) });
				} 

				var existingListener = JSON.parse(contents)
				  , newListener = new module.exports.Listener(existingListener.name);

				Object.keys(newListener).forEach(function(property) {
					if (existingListener.hasOwnProperty(property)) {
						newListener[property] = existingListener[property];
					}
				});

				Object.keys(existingListener.servers).forEach(function(serverName) {
					var newServer = new module.exports.ListenerServer();

					Object.keys(newServer).forEach(function(property) {
						if (existingListener.servers[serverName].hasOwnProperty(property)) {
							newServer[property] = existingListener.servers[serverName][property];
						}
					});
					
					newListener.servers[serverName] = newServer;
				});

				callback(null, newListener);
			});
		} else {
			callback({ message: 'The file ' + listenerFilePath + ' does not exist.' });
		}
	});
};
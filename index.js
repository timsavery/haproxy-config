var fs = require('fs')
  , path = require('path');

module.exports.Config = function() {
	this.listen = {};

	var self = this;
	fs.readdir('.', function(err, files) {
		files.forEach(function(file) {
			fs.stat(file, function(err, stats) {
				if (stats.isFile() && path.extname(file).length == 0) {
					self.listen[file] = new module.exports.Listen(file);
				}
			});
		});
	});

	this.save = function(callback) {
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

			Object.keys(self.listen).forEach(function(listenKey) {
				var listen = self.listen[listenKey];
				stream.write('listen ' + listen.name + '\n');
				stream.write('  bind *:' + listen.port + '\n');

				Object.keys(listen.servers).forEach(function(serverKey) {
					var server = listen.servers[serverKey];
					stream.write('  server ' + server.name + ' ' + server.host + ':' + server.port + ' maxconn ' + server.maxconn + '\n');
				});
			});

			callback();
		});
	};
};

module.exports.Listen = function(name) {
	this.name = name;
	this.port = 0;
	this.servers = {};

	var self = this, listenFilePath = './' + name;
	path.exists(listenFilePath, function(exists) {
		if (exists) {
			fs.readFile(listenFilePath, 'utf8', function(err, contents) {
				var existingConfig = JSON.parse(contents)
				  , props = ['port', 'servers'];

				props.forEach(function(prop) {
					if (existingConfig[prop]) {
						self[prop] = existingConfig[prop];
					}
				});		
			});
		}
	});

	this.addServer = function(name, host, port, maxconn) {
		this.servers[name] = {
			host: host,
			port: port || 80,
			maxconn: maxconn || 32
		};
	};

	this.save = function(callback) {
		fs.writeFile('./' + this.name, JSON.stringify({
			name: this.name,
			port: this.port,
			servers: this.servers
		}, null, 2));
	};

	this.asConfigEntry = function() {
		var self = this;

		var configStr = 'listen ' + this.name + '\n';
		configStr += '  bind *:' + this.port;

		Object.keys(self.servers).forEach(function(server) {
			var server = self.servers[server];
			configStr += '  server ' + server.name + ' ' + server.host + ':' + server.port + ' maxconn ' + server.maxconn;
		});

		return configStr;
	}
};
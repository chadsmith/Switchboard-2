var
	iniparser=require('iniparser'),
	csv = require('csv'),
	express = require('express'),
	io = require('socket.io'),
	crypto = require('crypto'),
	twilio = require('twilio'),
	config = iniparser.parseSync(__dirname + '/config.ini'),
	app = express.createServer(
		express.bodyDecoder(),
		express.cookieDecoder(),
		express.session({ secret: config.server.secret }),
		express.staticProvider(__dirname + '/public')
	),
	sockets = [],
	plugins = {},
	operators = {},
	redirects = {},
	queue = {},
	calls = {},
	twiml = twilio.Twiml,
	client = new twilio.Client(config.twilio.account_sid, config.twilio.auth_token, config.server.hostname, {port: config.twilio.port}),
	phone = client.getPhoneNumber(config.twilio.number.replace(/\D/g, '')),
	setup = function() {
		var
			required = {
				server: [ 'hostname', 'port', 'secret' ],
				twilio: [ 'account_sid', 'auth_token', 'number', 'port' ],
				switchboard: [ 'music' ]
			},
			section,
			field;
		for(section in required)
			for(field in required[section])
				if(!config[section][required[section][field]])
					throw new Error(section + ' ' + required[section][field] + ' missing from config.ini');
	},
	loadPlugins = function() {
		csv().fromPath(__dirname + '/plugins.txt', { delimiter: "\t" }).on('data', function(data, id) {
			id = md5(data[0]);
			plugins[id] = { id: id, name: data[0] };
			redirects[id] = 'http' == data[1].substr(0, 4) ? data[1] : 'http://twimlets.com/echo?Twiml=' + encodeURIComponent('<Response>' + data[1] + '</Response>');
		});
	},
	loadOperators = function() {
		csv().fromPath(__dirname + '/operators.txt', { delimiter: "\t" }).on('data', function(data, id) {
			id = md5(data[0]);
			operators[id] = { id: id, name: data[0], status: 'available' };
			redirects[id] = 'http://twimlets.com/forward?PhoneNumber=' + encodeURIComponent(data[1].replace(/\D/g, ''));
		});
	},
	md5 = function(text) {
		return crypto.createHash('md5').update(text).digest('hex');
	},
	broadcast = function(data) {
		for(var i=0; i<sockets.length; i++)
			sockets[i].send(data);
	};

setup();
loadPlugins();
loadOperators();

app.configure(function() {
	app.set('views', __dirname + '/templates');
	app.set('view engine', 'jade');
	app.set('view options', {
		layout: false
	});
});

app.get('/', function(req, res) {
	res.render(req.session.logged_in || !config.users ? 'index' : 'login', { locals: { number: config.twilio.number } });
});

app.post('/login', function(req, res){
	var username = req.body.username;
	var password = req.body.password;
	if(config.users && username in config.users && password == config.users[username]) {
		req.session.logged_in = true;
		res.redirect('/');
		console.log(username + ' logged in');
	}
	else
		res.send('Invalid username or password.');
});

app.get('/logout', function(req, res) {
	delete req.session.logged_in;
	res.redirect('/');
});

app.listen(config.server.port, config.server.hostname);
io = io.listen(app);

io.on('connection', function(socket) {
	sockets.push(socket);
	socket.send({ action: 'connect', queue: queue, plugins: plugins, operators: operators });
	socket.on('message', function(data, recipient) {
		if(data.id in redirects) {
			if(data.id in operators) {
				operators[data.id].status = 'busy';
				calls[data.sid] = queue[data.sid];
				calls[data.sid].id = data.id;
				recipient = operators[data.id].name;
				broadcast({ action: 'transfer', id: data.id, sid: data.sid });
			}
			else {
				recipient = plugins[data.id].name;
				broadcast({ action: 'complete', sid: data.sid });
			}
			console.log('Transfered call from ' + queue[data.sid].from + ' to ' + recipient);
			client.apiCall('POST', '/Calls/' + data.sid, { params: { 'Url': redirects[data.id] } });
			delete queue[data.sid];	
		}
	});
	socket.on('disconnect', function() {
		sockets.pop(socket);
	});
});

phone.setup(function() {
	phone.on('callStatus', function(req, res) {
		res.send();
		if('completed' == req.CallStatus) {
			if(req.CallSid in queue) {
				broadcast({ action: 'hangup', sid: req.CallSid, from: req.From });
				console.log(req.From + ' hung up');
				delete queue[req.CallSid];
			}
			else if(req.CallSid in calls) {
				broadcast({ action: 'finished', sid: req.CallSid, id: calls[req.CallSid].id });
				operators[calls[req.CallSid].id].status = 'available';
				console.log(operators[calls[req.CallSid].id].name + ' finished talking to ' + calls[req.CallSid].from);
				delete calls[req.CallSid];
			}
		}
	});
	phone.on('incomingCall', function(req, res) {
		res.append(new twiml.Say(config.switchboard.greeting));
		res.append(new twiml.Redirect('http://twimlets.com/holdmusic?Bucket=' + config.switchboard.music));
		res.send();
		queue[req.CallSid] = { sid: req.CallSid, from: req.From };
		broadcast({ action: 'incoming', sid: req.CallSid, from: req.From });
		console.log(req.From + ' is calling');
	});
});

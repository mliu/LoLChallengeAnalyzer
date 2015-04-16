var config = require('./config.js'),
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('mydb.db'),
	lolApi = require('leagueapi'),
	bcrypt = require('bcryptjs'),
	cors = require('cors'),
	bodyParser = require('body-parser'),
	express = require('express'),
	validator = require('validator'),
	express_jwt = require('express-jwt'),
	jwt = require('jsonwebtoken'),
	app = express()

// Initialize League API Poller, databases, settings etc.
lolApi.init(config.api_key);
lolApi.setRateLimit(10, 600);
// Champion stats for one match. 10 rows created per game.
db.run("CREATE TABLE if not exists champ_info (id INTEGER PRIMARY KEY, champion_id INTEGER, kills INTEGER, assists INTEGER, deaths INTEGER, win BOOLEAN, gold INTEGER, cs INTEGER, match_creation INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
// The correct brackets per round
db.run("CREATE TABLE if not exists batch_keys (id INTEGER PRIMARY KEY, batch_round INTEGER, batch TEXT)");
// A "game" between two teams
db.run("CREATE TABLE if not exists team_data (id INTEGER PRIMARY KEY, team_id INTEGER, team_kills INTEGER, team_assists INTEGER, team_deaths INTEGER, team_wins INTEGER, team_gold INTEGER, team_cs INTEGER)");
// A static table of all champions in league and their team
db.run("CREATE TABLE if not exists champions (id INTEGER PRIMARY KEY, champion_id INTEGER, team_id INTEGER)");
// A static table of all the teams in the bracket
db.run("CREATE TABLE if not exists teams (id INTEGER PRIMARY KEY, name TEXT, shortname TEXT, description TEXT)");
// User table
db.run("CREATE TABLE if not exists users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, summoner TEXT, bracket_id INTEGER UNIQUE, password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
// User brackets table
db.run("CREATE TABLE if not exists brackets (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE, batch62 TEXT, batch31 TEXT, batch16 TEXT, batch8 TEXT, batch4 TEXT, batch2 TEXT, batch1 TEXT, score INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
app.use(cors({origin: 'http://localhost'}));
app.use(bodyParser.json());
app.use(express_jwt({ secret: config.app_secret }).unless({path: ['/users', '/users/auth']}));
app.use(function (err, req, res, next) {
	if (err.name === 'UnauthorizedError') {
		res.status(401).json({ error: 'Invalid token. Please login again.' });
		return;
	}
});

// API Routes
// Get a bracket
app.get('/brackets/:bracket_id', function (req, res) {
	console.log(req.params.bracket_id);
});
// Create a bracket. req.body will have user_id and batch30 to batch1. Update the appropriate user column to set the bracket_id to the created bracket.
app.post('/brackets', function (req, res) {
	db.run("INSERT INTO brackets(user_id, batch30, batch15, batch8, batch4, batch2, batch1) VALUES ($user_id, $batch30, $batch15, $batch8, $batch4, $batch2, $batch1)", {
		$user_id: req.user.id,
		$batch30: req.body.batch30,
		$batch15: req.body.batch15,
		$batch8: req.body.batch8,
		$batch4: req.body.batch4,
		$batch2: req.body.batch2,
		$batch1: req.body.batch1
	}, function (err, response) {
		if(!err) {
			res.json({ success: true });
			return;
		} else {
			res.status(400).json({ error: "There were errors with your response: " + err });
		}
	});
});
// Edit a bracket. req.body will have batch30, batch15, batch8, batch4, batch2, and batch1
app.put('/brackets/:bracket_id', function (req, res) {
	db.run("UPDATE brackets SET batch30 = $batch30, batch15 = $batch15, batch8 = $batch8, batch4 = $batch4, batch2 = $batch2, batch1 = $batch1 WHERE user_id = $user_id)", {
		$user_id: req.user.id,
		$batch30: req.body.batch30,
		$batch15: req.body.batch15,
		$batch8: req.body.batch8,
		$batch4: req.body.batch4,
		$batch2: req.body.batch2,
		$batch1: req.body.batch1
	}, function(err, response) {
		if(!err) {
			res.json({ success: true });
			return;
		} else {
			res.status(400).json({ error: "There were errors with your response: " + err });
		}
	});
});

// Edit a user information. req.body will have summoner and password.
app.put('/users/:user_id', function (req, res) {
	db.run("UPDATE users SET summoner = $summoner, password = $password WHERE user_id = $user_id)", {
		$user_id: req.user.id,
		$summoner: req.body.summoner,
		$password: req.body.password
	}, function(err, response) {
		if(!err) { 
			res.json({ success: true });
			return;
		} else {
			res.status(400).json({ error: "There were errors with your response: " + err });
		}
	})
});

app.get('/me', function (req, res) {
	if(req.user.id) {
		db.get("SELECT * FROM users WHERE id=?", req.user.id, function (err, response) {
			if(response) {
				res.json(
				{
					"id": response.id,
					"username": response.username,
					"summoner": response.summoner,
					"created_at": response.created_at
				})
			} 
			else { 
				res.status(400).json({ error: "No user found. Please try again." }) 
				return;
			}
		})
	} else {
		res.status(400).json({ error: "Invalid request" })
		return;
	}
});
app.post('/users/auth', function (req, res) {
	if(validator.isNull(req.body.password) || !validator.isLength(req.body.password, 6) || validator.isNull(req.body.username) || !validator.isLength(req.body.username, 4, 20)) {
		res.status(400).json({ error: "Invalid username/password, please try again." });
		return;
	}
	db.get("SELECT * FROM users WHERE username=? COLLATE NOCASE", req.body.username, function (err, response) {
		if(response) {
			bcrypt.compare(req.body.password, response.password, function (err, matches) {
				if(matches) {
					var token = jwt.sign({ id: response.id }, config.app_secret);
					res.json({ token: token, user: { username: response.username, summoner: response.summoner, created_at: response.created_at } });
					return;
				} else {
					res.status(400).json({ error: "Invalid username/password, please try again." });
					return;
				}
			});
		} else {
			res.status(400).json({ error: "Invalid username/password, please try again." });
			return;
		}
	});
});
app.post('/users', function (req, res) {
	if(validator.isNull(req.body.password)) {
		req.status(400).json({ error: "Password cannot be blank" });
		return;
	}
	if(!validator.isLength(req.body.password, 6)) {
		res.status(400).json({ error: "Password must be at least 6 characters" });
		return;
	}
	if(validator.isNull(req.body.username)) {
		res.status(400).json({ error: "Username cannot be blank" });
		return;
	}
	if(!validator.isLength(req.body.username, 4, 20)) {
		res.status(400).json({ error: "Username must be 4-20 characters" });
		return;
	}
	db.get("SELECT * FROM users WHERE username=? COLLATE NOCASE", req.body.username, function (err, response) {
		if(response) {
			res.status(409).json({ error: "This user is already registered" });
			return;
		} else {
			bcrypt.hash(req.body.password, 10, function (err, hash) {
				if(!err) {
					db.run("INSERT INTO users(username, summoner, password) VALUES ($username, $summoner, $password)", {
						$username: req.body.username,
						$summoner: req.body.summoner,
						$password: hash
					}, function (err) {
						if(!err) {
							res.json({ success: true });
							return;
						} else {
							res.status(500).json({ error: "Sorry, something went wrong. Please try again" });
							return;
						}
					});
				}
			})
		}
	})
});

var server = app.listen(3000, function () {
	console.log("app listening on port 3000");
});

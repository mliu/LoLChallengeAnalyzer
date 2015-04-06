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
db.run("CREATE TABLE if not exists champ_info (id INTEGER PRIMARY KEY, champion_id INTEGER, kills INTEGER, assists INTEGER, deaths INTEGER, win BOOLEAN, gold INTEGER, cs INTEGER, match_creation INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
db.run("CREATE TABLE if not exists users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, summoner TEXT,password TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
db.run("CREATE TABLE if not exists brackets (id INTEGER PRIMARY KEY, user_id INTEGER UNIQUE, bracket TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
app.use(express_jwt({ secret: config.app_secret }).unless({path: ['/users', '/users/auth']}));
app.use(function(err, req, res, next) {
	if (err.name === 'UnauthorizedError') {
		res.status(401).json( { error: 'Invalid token. Please login again.' });
		return;
	}
});
app.use(cors({origin: 'http://localhost'}));
app.use(bodyParser.json());

// Takes matchId and returns a JSON object (1 depth) of data we're interested in (e.g. kills, deaths, CS, etc.)
function storeMatchData(matchId) {
	var stmt;
	lolApi.getMatch(matchId, true, 'na', function(err, response) {
		if(!err) {
			db.run("BEGIN TRANSACTION");
			stmt = db.prepare("INSERT INTO champ_info(champion_id, kills, assists, deaths, win, gold, cs, match_creation) VALUES ($champion_id, $kills, $assists, $deaths, $win, $gold, $cs, $match_creation)");
			for ( participant in response.participants ) {
				db.serialize(function() {
					stmt.run({
						$champion_id: response.participants[participant].championId,
						$kills: response.participants[participant].stats.kills,
						$assists: response.participants[participant].stats.assists,
						$deaths: response.participants[participant].stats.deaths,
						$win: response.participants[participant].stats.winner,
						$gold: response.participants[participant].stats.goldEarned,
						$cs: response.participants[participant].stats.minionsKilled,
						$match_creation: response.matchCreation
					});
				});
			}		
			stmt.finalize();
			db.run("END");
		}
	});
}

// API Routes
app.get('/brackets', function (req, res) {
	// db.each("SELECT * from brackets ")
});
app.patch('/users/:user_id', function (req, res) {

});
app.get('/me', function(req, res) {
	if(req.user.id) {
		console.log("a");
	}
});
app.post('/users/auth', function (req, res) {
	if(validator.isNull(req.body.password) || !validator.isLength(req.body.password, 6) || validator.isNull(req.body.username) || !validator.isLength(req.body.username, 4, 20)) {
		res.status(400).json({ error: "Invalid username/password, please try again." });
		return;
	}
	db.get("SELECT * FROM users WHERE username=? COLLATE NOCASE", req.body.username, function(err, response) {
		if(response) {
			bcrypt.compare(req.body.password, response.password, function(err, matches) {
				if(matches) {
					var token = jwt.sign({ id: response.id }, config.app_secret);
					res.json({ token: token, user: { username: response.username, summoner: response.summoner, created_at: response.created_at } });
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
	db.get("SELECT * FROM users WHERE username=? COLLATE NOCASE", req.body.username, function(err, response) {
		if(response) {
			res.status(409).json({ error: "This user is already registered" });
		} else {
			bcrypt.hash(req.body.password, 10, function(err, hash) {
				if(!err) {
					db.run("INSERT INTO users(username, summoner, password) VALUES ($username, $summoner, $password)", {
						$username: req.body.username,
						$summoner: req.body.summoner,
						$password: hash
					}, function(err) {
						if(!err) {
							res.json({ success: true });
						} else {
							res.status(500).json({ error: "Sorry, something went wrong. Please try again" });
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

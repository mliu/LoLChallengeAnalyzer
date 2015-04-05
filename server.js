var config = require('./config.js'),
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('mydb.db'),
	lolApi = require('leagueapi'),
	bcrypt = require('bcryptjs'),
	cors = require('cors'),
	bodyParser = require('body-parser'),
	express = require('express'),
	validator = require('validator'),
	jwt = require('express-jwt'),
	app = express()

// Initialize League API Poller, databases, settings etc.
lolApi.init(config.api_key);
lolApi.setRateLimit(10);
db.run("CREATE TABLE if not exists champ_info (id INTEGER PRIMARY KEY, champion_id INTEGER, kills INTEGER, assists INTEGER, deaths INTEGER, win BOOLEAN, gold INTEGER, cs INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
db.run("CREATE TABLE if not exists users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, summoner TEXT, password TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
db.run("CREATE TABLE if not exists brackets (id INTEGER PRIMARY KEY, user_id INTEGER, content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
app.use(jwt({ secret: config.app_secret }).unless({path: ['/users']}));
app.use(cors({origin: 'http://localhost'}));
app.use(bodyParser.json());

// Takes matchId and returns a JSON object (1 depth) of data we're interested in (e.g. kills, deaths, CS, etc.)
function storeMatchData(matchId) {
	var stmt;
	lolApi.getMatch(matchId, true, 'na', function(err, response) {
		if(!err) {
			db.run("BEGIN TRANSACTION");
			stmt = db.prepare("INSERT INTO champ_info VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)");
			for ( participant in response.participants ) {
				db.serialize(function() {
					stmt.run(response.participants[participant].championId, response.participants[participant].stats.kills, response.participants[participant].stats.assists, response.participants[participant].stats.deaths, response.participants[participant].stats.winner, response.participants[participant].stats.goldEarned, response.participants[participant].stats.minionsKilled);
				});
			}		
			stmt.finalize();
			db.run("END");
		}
	});
}
// Test command
// storeMatchData("1782367531");

// API Routes
app.route('/users')
	.get(function(req, res) {

	})
	.post(function (req, res) {
		if(!validator.isLength(req.body.password, 6)) {
			res.status(400).json({ error: "Password must be at least 6 characters" });
			return;
		}
		if(!validator.isNull(req.body.username)) {
			res.status(400).json({ error: "Username cannot be blank" });
			return;
		}
		if(!validator.isLength(req.body.username, 6, 20)) {
			res.status(400).json({ error: "Username must be 6-20 characters" });
			return;
		}
		db.get("SELECT * FROM users WHERE name = " + req.body.username + " COLLATE NOCASE", function(err, response) {
			if(response) {
				res.status(409).json({ error: "This user is already registered" });
			} else {
				bcrypt.hash(req.body.password, 10, function(err, hash) {
					if(!err) {
						db.run("INSERT INTO users VALUES (NULL, ?, ?)", [req.body.username, req.body.summoner, hash]);
					}
				})
			}
		})
	})

var server = app.listen(3000, function () {
	console.log("app listening on port 3000");
});

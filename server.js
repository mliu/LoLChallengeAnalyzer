var config = require('./config.js');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('mydb.db');
var lolApi = require('leagueapi');

// Initialize League API Poller
lolApi.init(config.api_key);

// Takes matchId and returns a JSON object (1 depth) of data we're interested in (e.g. kills, deaths, CS, etc.)
function storeMatchData(matchId) {
	var stmt;
	lolApi.getMatch(matchId, true, 'na', function(err, response) {
		if(!err) {
			db.run("BEGIN TRANSACTION");
			for ( participant in response.participants ) {
				db.serialize(function() {
					db.run("CREATE TABLE if not exists c" + response.participants[participant].championId + " (id INTEGER PRIMARY KEY, kills INTEGER, assists INTEGER, deaths INTEGER, win BOOLEAN, gold INTEGER, cs INTEGER)");
					stmt = db.prepare("INSERT INTO c" + response.participants[participant].championId + " VALUES (NULL, ?, ?, ?, ?, ?, ?)");
					stmt.run(response.participants[participant].stats.kills, response.participants[participant].stats.assists, response.participants[participant].stats.deaths, response.participants[participant].stats.winner, response.participants[participant].stats.goldEarned, response.participants[participant].stats.minionsKilled);
					stmt.finalize();
				});
			}		
			db.run("END");
		}
	});
}

storeMatchData("1782367531");

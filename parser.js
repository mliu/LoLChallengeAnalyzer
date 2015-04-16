var config = require('./config.js'),
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('mydb.db'),
	dumpdb = new sqlite3.Database('dump.db'),
	lolApi = require('leagueapi')

dumpdb.run("CREATE TABLE if not exists champ_info (id INTEGER PRIMARY KEY, champion_id INTEGER, kills INTEGER, assists INTEGER, deaths INTEGER, win BOOLEAN, gold INTEGER, cs INTEGER, match_creation INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
lolApi.init(config.api_key);
lolApi.setRateLimit(10, 600);

function loopthrough() {
	db.run("BEGIN TRANSACTION");
	db.each("SELECT * FROM match_dump", function(err, id) {
		if(!err) {
			storeMatchData(id.info);
		}
	});
	db.run("END TRANSACTION");
}

function storeMatchData(matchId) {
	var stmt;
	lolApi.getMatch(matchId, true, 'na', function(err, response) {
		console.log("Match response");
		if(!err) {
			stmt = dumpdb.prepare("INSERT INTO champ_info(champion_id, kills, assists, deaths, win, gold, cs, match_creation) VALUES ($champion_id, $kills, $assists, $deaths, $win, $gold, $cs, $match_creation)");
			for ( participant in response.participants ) {
				dumpdb.serialize(function() {
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
		}
	});
}

loopthrough();

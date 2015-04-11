var config = require('./config.js'),
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('mydb.db'),
	dumpdb = new sqlite3.Database('dump.db'),
	lolApi = require('leagueapi')

lolApi.init(config.api_key);
lolApi.setRateLimit(10, 600);

function loopthrough() {
	dumpdb.run("BEGIN TRANSACTION");
	dumpdb.each("SELECT * FROM match_dump", function(err, id) {
		if(!err) {
			console.log(id.info);
			storeMatchData(id.info);
		}
	});
	dumpdb.run("END TRANSACTION");
}

function storeMatchData(matchId) {
	var stmt;
	lolApi.getMatch(matchId, true, 'na', function(err, response) {
		if(!err) {
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
		}
	});
}

loopthrough();
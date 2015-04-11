var config = require('./config.js'),
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('mydb.db'),
	lolApi = require('leagueapi'),
	moment = require('moment');

// Initialize League API Poller, databases, settings etc.
lolApi.init(config.api_key);
lolApi.setRateLimit(10, 600);

// Takes in all match data on the day (UNIX timestamp) and puts it into the matches table
function generateMatchResults(starttime, endtime) {
	db.run("BEGIN TRANSACTION");
	db.each("SELECT * FROM champ_info", function (err, champ_info) {
		if(!err) {
			db.run("SELECT * FROM champions WHERE champion_id=$champion_id", {$champion_id: champ_info.champion_id}, function (err, champion) {
				db.run("SELECT * FROM team_data WHERE team_id=$team_id", {$team_id: champion.team_id}, function (err, team_data) {
					db.run("UPDATE team_data SET team_kills=$team_kills, team_assists=$team_assists, team_deaths=$team_deaths, team_wins=$team_wins, team_gold=$team_gold, team_cs=$team_cs", {
						$team_kills: team_data.team_kills + champ_info.kills,
						$team_assists: team_data.team_assists + champ_info.assists,
						$team_deaths: team_data.team_deaths + champ_info.deaths,
						$team_wins: team_data.team_wins + champ_info.win,
						$team_gold: team_data.team_gold + champ_info.gold,
						$team_cs: team_data.team_cs + champ_info.cs
					}, function (err, response) {
						if(err) {
							console.log(err);
						}
					})
				})
			})
		}
	});
	db.run("END");
}

// Generates the correct batch of champions going into the next round. Matches should have already been populated by this point.
function generateBatchKeys() {
	var batch_type = 30,
		batch = null,
		team_1_id = null,
		team_2_id = null,
		key = [];
	// Find batch type to generate keys for
	db.get("SELECT * FROM batch_keys ORDER BY id DESC", function (err, round) {
		if(round) {
			batch_type = Math.ceil(round.batch_round/2);
			batch = JSON.parse(round.batch);
		}
	});
	if(batch_type = 30) {
		// Array of team ids
		batch = [];
	}
	for(var i=0;i<Math.floor(batch.length/2);i++) {
		team_1_id = batch[2*i];
		// If there is a case where a team doesn't have a rival
		if((2*i)+1>batch.length) {
			key.append(team_1_id);
		}
		else {
			team_2_id = batch[(2*i)+1];
			db.get("SELECT * FROM team_data WHERE team_id=$team_1_id", {$team_1_id: team_1_id}, function (err, team_1_data) {
				db.get("SELECT * FROM team_data WHERE team_id=$team_2_id", {$team_2_id: team_2_id}, function (err, team_2_data) {
					if(determineWinner(team_1_data, team_2_data) == 1) {
						key.append(team_1_id);
					} else {
						key.append(team_2_id);
					}
				});
			});
		}
	}
	// Insert new key into batch_keys table
	db.run("INSERT INTO batch_keys(batch_round, batch) VALUES ($batch_round, $batch)", {$batch_round: batch_type, $batch: key}, function (err, response) {
		if(err) {
			console.log("Error generating batch keys! " + err);
		}
	});
}

// Returns 1 or 2 based on the match data
function determineWinner(team_1_data, team_2_data) {

}

// Loops through every bracket and calculates its score
function generateBatchScores(num, key) {
	var batch;
	db.run("BEGIN TRANSACTION");
	db.each("SELECT $batch,score FROM brackets", {$batch: "batch"+num}, function (err, row) {
		batch = JSON.parse(row["batch"+num]);
		for(var i=0;i<Math.floor(batch.length/2);i++) {
			if(batch[i] == key[i]) {
				score++;
			}
		}
		db.run("UPDATE brackets SET score=$score WHERE id=$id", {
			$score: score,
			$id: row.id
		});
	});
	db.run("END");
}

// Takes matchId and returns a JSON object (1 depth) of data we're interested in (e.g. kills, deaths, CS, etc.)
function storeMatchData(matchId) {
	var stmt;
	lolApi.getMatch(matchId, true, 'na', function (err, response) {
		if(!err) {
			db.run("BEGIN TRANSACTION");
			stmt = db.prepare("INSERT INTO champ_info(champion_id, kills, assists, deaths, win, gold, cs, match_creation) VALUES ($champion_id, $kills, $assists, $deaths, $win, $gold, $cs, $match_creation)");
			for ( participant in response.participants ) {
				db.serialize(function () {
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

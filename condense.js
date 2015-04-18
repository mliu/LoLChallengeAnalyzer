var config = require('./config.js'),
	sqlite3 = require('sqlite3').verbose(),
	db = new sqlite3.Database('mydb.db'),
	source = new sqlite3.Database('dump.db'),
	lolApi = require('leagueapi')

lolApi.init(config.api_key);
lolApi.setRateLimit(10, 600);

function combininator() {
	db.run("BEGIN TRANSACTION");

	source.each("SELECT * FROM champ_info", function (err, one_champion) {
		if (!err) {
			db.run("SELECT * FROM champ_info WHERE champion_id=$champion_id", {$champion_id: one_champion.champion_id}, function (err, total_champion) {
				if (total_champion != undefined) {
					db.run("UPDATE champ_info SET kills=$kills, assists=$assists, deaths=$deaths, win=$win, gold=$gold, cs=$cs WHERE champion_id=$champion_id", {
						$kills: total_champion.kills + one_champion.kills,
						$assists: total_champion.assists + one_champion.assists,
						$deaths: total_champion.deaths + one_champion.deaths,
						$win: total_champion.win + one_champion.win,
						$gold: total_champion.gold + one_champion.gold,
						$cs: total_champion.cs + one_champion.cs,
						$champion_id: one_champion.champion_id
					}, function (err, response) { 
						if (err) {
							console.log(err);
						}
					});
				}
				else {
					db.run("INSERT INTO champ_info(champion_id, kills, assists, deaths, win, gold, cs) VALUES ($champion_id, $kills, $assists, $deaths, $win, $gold, $cs)", {
						$champion_id: one_champion.champion_id,
						$kills: one_champion.kills,
						$assists: one_champion.assists,
						$deaths: one_champion.deaths,
						$win: one_champion.win,
						$gold: one_champion.gold,
						$cs: one_champion.cs
					}, function (err, response) {
						if (err) {
							console.log(err);
						}
					});
				}
			});
		}
	});
	db.run("END TRANSACTION");
}

combininator();
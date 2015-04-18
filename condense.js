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
				db.run("UPDATE champ_info SET kills=$kills, assists=$assists, deaths=$deaths, win=$win, gold=$gold, cs=$cs WHERE champion_id=$champion_id", {
					$kills: total_champion.kills + one_champion.kills,
					$assists: total_champion.assists + one_champion.assists,
					$deaths: total_champion.deaths + one_champion.deaths,
					$win: (~~total_champion.win) + (~~one_champion.win),
					$gold: total_champion.gold + one_champion.gold,
					$cs: total_champion.cs + one_champion.cs,
					$champion_id: one_champion.champion_id
				}, function (err, response) { 
					if (err) {
						console.log(err);
					}
				});
				console.log(total_champion.kills);
				console.log(one_champion.kills);
			});
		}
	});
	db.run("END TRANSACTION");
}

combininator();
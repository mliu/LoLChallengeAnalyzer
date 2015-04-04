var config = require('./config.js');
var lolApi = require('leagueapi');

// Initialize League API Poller
lolApi.init(config.api_key);

// Takes matchId and returns a JSON object (1 depth) of data we're interested in (e.g. kills, deaths, CS, etc.)
function storeMatchData(matchId) {
	lolApi.getMatch(matchId, true, 'na', function(err, response) {
		if(!err) {
			for ( participant in response.participants ) {
				var data = 
				{
					"kills": response.participants[participant].stats.kills,
					"assists": response.participants[participant].stats.assists,
					"deaths": response.participants[participant].stats.deaths,
					"win": response.participants[participant].stats.winner,
					"gold": response.participants[participant].stats.goldEarned,
					"cs": response.participants[participant].stats.minionsKilled 
				}
				console.log(data);
				// store this object by response.championId
			}
			// Do what you want with the response data
			
		}
	});
}

storeMatchData("1782367531");

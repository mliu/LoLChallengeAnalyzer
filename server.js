var config = require('./config.js');
var lolApi = require('leagueapi');

// Initialize League API Poller
lolApi.init(config.api_key);

// Takes matchId and returns a JSON object (1 depth) of data we're interested in (e.g. kills, deaths, CS, etc.)
function storeMatchData(matchId) {
	lolApi.getMatch(matchId, true, 'na', function(err, response) {
		if(!err) {
			// Do what you want with the response data
			console.log(response.region);
		}
	});
}

storeMatchData("1782367531");

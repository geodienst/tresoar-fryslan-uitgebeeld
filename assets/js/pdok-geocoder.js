var pdok = new Bloodhound({
	datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
  	queryTokenizer: Bloodhound.tokenizers.whitespace,
	remote: {
		url: 'https://geodata.nationaalgeoregister.nl/locatieserver/v3/suggest',
		prepare: function(query, settings) {
			settings.type = 'GET';
			settings.dataType = 'json';
			settings.data = {
				q: query
			};
			return settings;
		},
		transform: function(json) {
			var suggestions = json.response.docs;

			suggestions.forEach(function(suggestion) {
				suggestion.fetch = function(callback) {
					$.getJSON('https://geodata.nationaalgeoregister.nl/locatieserver/v3/lookup?', {id: suggestion.id}, function(data) {
						callback(data.response.docs[0]);
					});
				};
			})

			return suggestions;
		}
	}
})

$('input[data-provider="pdok-geocoder"]').typeahead({
	highlight: true,
	minLength: 3
}, {
	name: 'pdok-geocoder',
	display: 'weergavenaam',
	source: pdok
})
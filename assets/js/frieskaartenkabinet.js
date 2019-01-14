function FriesKaartenKabinet() {
	this.cache = {};
};

FriesKaartenKabinet.prototype.get = function(kaarnt) {
	if (this.cache[kaarnt] !== undefined)
		return this.cache[kaarnt];

	return this.cache[kaarnt] = jQuery.ajax({
			url: 'http://www.frieskaartenkabinet.nl/api/search/v1/',
			cache: true,
			dataType: 'jsonp',
			data: {
				query: 'tresoar_local_id.raw:' + kaarnt,
				rows: 1,
				format: 'jsonp'
			}
		}).then(
			function(response) {
				return response.result.items[0].item.fields;
			},
			function() {
				return null;
			}
		);
};

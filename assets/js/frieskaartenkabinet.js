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
				query: 'doc_type:kaarten_maprecord,id:' + kaarnt,
				rows: 1,
				format: 'jsonp'
			}
		}).then(
			function(response) {
				return response.result[0].items[0].item.fields;
			},
			function() {
				return null;
			}
		);
};

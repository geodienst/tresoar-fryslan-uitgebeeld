function FriesKaartenKabinet() {
	this.cache = {};
};

FriesKaartenKabinet.prototype.get = function(kaarnt) {
	if (this.cache[kaarnt] !== undefined)
		return this.cache[kaarnt];

	return this.cache[kaarnt] = jQuery.ajax({
			url: 'http://www.frieskaartenkabinet.nl/api/search/v2/',
			cache: true,
			dataType: 'jsonp',
			data: {
				query: 'tresoar_local_id.raw:' + kaarnt,
				rows: 1,
				format: 'jsonp'
			}
		}).then(
			function(response) {
                if (response.result.items.length != 0) {
                    return response.result.items[0].item.fields;
                } else {
                    console.log('no result for kaartnr: ' + kaarnt);
                    return null;
                }
			},
			function() {
				return null;
			}
		);
};

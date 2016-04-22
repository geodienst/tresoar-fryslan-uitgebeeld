var pdok = new Bloodhound({
	datumTokenizer: Bloodhound.tokenizers.obj.whitespace('name'),
  	queryTokenizer: Bloodhound.tokenizers.whitespace,
	remote: {
		url: 'http://geodata.nationaalgeoregister.nl/geocoder/Geocoder',
		prepare: function(query, settings) {
			settings.type = 'GET';
			settings.dataType = 'xml';
			settings.data = {
				zoekterm: query,
				strict: false
			};
			return settings;
		},
		transform: function(xmlDoc) {
			var ns = {
				xls: 'http://www.opengis.net/xls',
				gml: 'http://www.opengis.net/gml'
			};

			var adressen = [];

			var geocodedAdres = xmlDoc.getElementsByTagNameNS(ns.xls, "GeocodedAddress");
	
			for (var i=0; i < geocodedAdres.length;i++) {
				var adres = {
					straat: '',
					huisnummer: '',
					huisletter: '',
					postcode: '',
					plaats: '',
					provincie: '',
					name: '',
					pos: ''
				}

				adres.pos = geocodedAdres[i].getElementsByTagNameNS(ns.gml, "pos")[0].childNodes[0].nodeValue;
				if (geocodedAdres[i].getElementsByTagNameNS(ns.xls, "Street").length > 0) {
					adres.straat = geocodedAdres[i].getElementsByTagNameNS(ns.xls, "Street")[0].childNodes[0].nodeValue;	
					
					if (geocodedAdres[i].getElementsByTagNameNS(ns.xls, "Building").length > 0){
						adres.huisnummer = geocodedAdres[i].getElementsByTagNameNS(ns.xls, "Building")[0].getAttribute("number");
						if (geocodedAdres[i].getElementsByTagNameNS(ns.xls, "Building")[0].getAttribute("subdivision")) {
								adres.huisletter = geocodedAdres[i].getElementsByTagName(ns.xls, "Building")[0].getAttribute("subdivision");
						}
					}

					if (geocodedAdres[i].getElementsByTagNameNS(ns.xls, "PostalCode").length > 0){
						adres.postcode = geocodedAdres[i].getElementsByTagNameNS(ns.xls, "PostalCode")[0].childNodes[0].nodeValue;	
					}
				}

				var places = geocodedAdres[i].getElementsByTagNameNS(ns.xls, "Place")
				for (j=0;j < places.length;j++){
					if (places[j].getAttribute("type") == "MunicipalitySubdivision") {
						adres.plaats = places[j].childNodes[0].nodeValue;
					}
					if (places[j].getAttribute("type") == "CountrySubdivision") {
						adres.provincie = places[j].childNodes[0].nodeValue;
					}
				};

				var nonEmpty = function(inp) {
					return inp != '';
				}

				adres.name = [
					[adres.straat, adres.huisnummer, adres.huisletter].filter(nonEmpty).join(' '),
					[adres.postcode, adres.plaats].filter(nonEmpty).join(' '),
					[adres.provincie].join(' ')
				].filter(nonEmpty).join(', ');

				if (adres.huisnummer)
					adres.niveau = 'huisnummer';
				else if (adres.straat)
					adres.niveau = 'straat';
				else if (adres.plaats)
					adres.niveau = 'plaats';
				else if (adres.provincie)
					adres.niveau = 'provincie';
				else
					adres.niveau = 'onbekend';

				adressen.push(adres);
			}

			return adressen;
		}
	}
})

$('input[data-provider="pdok-geocoder"]').typeahead({
	highlight: true,
	minLength: 3
}, {
	name: 'pdok-geocoder',
	display: 'name',
	source: pdok
});
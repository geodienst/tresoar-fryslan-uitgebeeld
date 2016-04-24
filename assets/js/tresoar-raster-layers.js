Viewer.loaders.WMS = function(options, viewer) {
	var ns = {
		wms: 'http://www.opengis.net/wms'
	};
	
	function getChildNodesByTagNameNS(ns, parent, nodeName) {
		return $.makeArray(parent.childNodes).filter(function(child) {
			return child.nodeType == parent.ELEMENT_NODE
				&& child.namespaceURI == ns
				&& child.nodeName == nodeName;
		});
	}

	return $.ajax(options.url, {
		type: 'GET',
		data: {
			service: 'wms',
			version: '1.3.0',
			request: 'GetCapabilities',
			namespace: 'tresoar'
		}
	}).done(function(data) {

		var wmsLayers = $.makeArray(data.getElementsByTagNameNS(ns.wms, 'Layer')).map(function(layer) {
			var $layer = $(layer);

			var $bbox = getChildNodesByTagNameNS(ns.wms, layer, 'BoundingBox').find(function(el) {
				return el.hasAttribute('CRS') && el.getAttribute('CRS') == 'EPSG:28992';
			});

			var bbox = $bbox ? new ol.Feature({
				//typename: $layer.find('title').text(),
				geometry: new ol.geom.Polygon([[
					[$bbox.getAttribute('minx'), $bbox.getAttribute('miny')].map(parseFloat),
					[$bbox.getAttribute('maxx'), $bbox.getAttribute('miny')].map(parseFloat),
					[$bbox.getAttribute('maxx'), $bbox.getAttribute('maxy')].map(parseFloat),
					[$bbox.getAttribute('minx'), $bbox.getAttribute('maxy')].map(parseFloat),
					[$bbox.getAttribute('minx'), $bbox.getAttribute('miny')].map(parseFloat)
				]], 'XY')
			}) : null;

			// Skip data without bbox for now.
			if (!bbox) return null;

			var extent = [
				$bbox.getAttribute('minx'), $bbox.getAttribute('miny'),
				$bbox.getAttribute('maxx'), $bbox.getAttribute('maxy')].map(parseFloat);

			var name = getChildNodesByTagNameNS(ns.wms, layer, 'Name')[0].textContent;
			var title = getChildNodesByTagNameNS(ns.wms, layer, 'Title')[0].textContent;

			// Ugly side-effect implementation
			viewer.addLayer(new ol.layer.Tile({
				id: name,
				name: title,
				extent: extent,
				bbox: bbox,
				thumbnail: options.url + '?' + jQuery.param({
					service: 'wms',
					version: '1.3.0',
					request: 'getMap',
					format: 'image/jpeg',
					transparent: false,
					styles: '',
					layers: name,
					crs: 'EPSG:28992',
					srs: 'EPSG:28992',
					width: 256,
					height: 256,
					tiled: true,
					bbox: bbox.getGeometry().getExtent().join(',')
				}),
				source: new ol.source.TileWMS({
					url: options.url,
					attributions: options.attributions,
					serverType: 'geoserver',
					params: {
						LAYERS: name,
						TILED: true,
						TRANSPARENT: false,
						FORMAT: 'image/jpeg'
					},
					projection: 'EPSG:28992'
				})
			}));

			return bbox;
		});
	});
};
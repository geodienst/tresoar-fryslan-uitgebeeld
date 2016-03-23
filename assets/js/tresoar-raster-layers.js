var TRESOAR_WMS_URL = 'http://localhost:8080/geoserver/ows';

$.ajax(TRESOAR_WMS_URL, {
	type: 'GET',
	crossdomain: true,
	data: {
		service: 'wms',
		version: '1.3.0',
		request: 'GetCapabilities',
		namespace: 'tresoar'
	}
}).done(function(data) {
	var wmsLayers = $(data).find('Layer > Layer').map(function() {
		var $layer = $(this),
			$bbox = $layer.find('boundingbox[crs="EPSG:28992"]');

		var bbox = $bbox.length ? new ol.Feature({
			typename: $layer.find('title').text(),
			geometry: new ol.geom.Polygon([[
				[$bbox.attr('minx'), $bbox.attr('miny')].map(parseFloat),
				[$bbox.attr('maxx'), $bbox.attr('miny')].map(parseFloat),
				[$bbox.attr('maxx'), $bbox.attr('maxy')].map(parseFloat),
				[$bbox.attr('minx'), $bbox.attr('maxy')].map(parseFloat)
			]], 'XY')
		}) : null;

		if (!bbox) {
			console.log("Skipping", $layer.find('name').text(), "because it doesn't have a bounding box with crs=EPSG:28992");
			return null;
		}

		var extent = [
			$bbox.attr('minx'), $bbox.attr('miny'),
			$bbox.attr('maxx'), $bbox.attr('maxy')].map(parseFloat);

		// Ugly side-effect implementation
		window.layers[$layer.find('name').text()] = new ol.layer.Tile({
			id: $layer.find('name').text(),
			name: $layer.find('title').text(),
			extent: extent,
			bbox: bbox,
			thumbnail: TRESOAR_WMS_URL + '?' + jQuery.param({
				service: 'wms',
				version: '1.3.0',
				request: 'getMap',
				format: 'image/png',
				transparent: true,
				styles: '',
				layers: $layer.find('name').text(),
				srs: 'EPSG:28992',
				width: 300,
				height: 300,
				bbox: bbox.getGeometry().getExtent().join(',')
			}),
			source: new ol.source.TileWMS({
				url: TRESOAR_WMS_URL,
				serverType: 'geoserver',
				params: {
					LAYERS: $layer.find('name').text(),
					TILED: true	
				},
				projection: 'EPSG:28992'
			}),
			style: new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: 'green',
					width: 2
				})
			})
		});

		return bbox;
	}).get();

	// Add a debug map that contains all the extents of the just fetched WFS
	window.layers['GeoServerWMS'] = new ol.layer.Vector({
		id: 'GeoServerWMS',
		name: '#Geoserver WMS',
		source: new ol.source.Vector({
			features: wmsLayers,
			strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
				maxZoom: 19
			})),
			projection: 'EPSG:28992',
			attributions: [new ol.Attribution({
				html: 'Geoserver bboxes'
			})],
		}),
		style: new ol.style.Style({
			stroke: new ol.style.Stroke({
				color: 'green',
				width: 2
			}),
			fill: new ol.style.Fill({
				color: [0, 0, 255, 0.6]
			})
		})
	});

	updateLayerList();
});
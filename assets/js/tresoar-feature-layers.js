$.ajax('http://geoportaal.fryslan.nl/arcgis/services/ProvinciaalGeoRegister/PGR_features/GeoDataServer/WFSServer', {
	type: 'GET',
	crossdomain: true,
	dataType: 'xml',
	data: {
		service: 'WFS',
		version: '1.0.0',
		request: 'GetCapabilities'
	}
}).done(function(data) {
	var features = $(data).find('FeatureTypeList').map(function() {
		return $(this).find('FeatureType').map(function() {
			var $feature = $(this),
				$bbox = $feature.find('LatLongBoundingBox');

			var bbox = $bbox.length ? new ol.Feature({
				typename: $feature.find('Name').text(),
				geometry: new ol.geom.Polygon([[
					[$bbox.attr('minx'), $bbox.attr('miny')].map(parseFloat),
					[$bbox.attr('maxx'), $bbox.attr('miny')].map(parseFloat),
					[$bbox.attr('maxx'), $bbox.attr('maxy')].map(parseFloat),
					[$bbox.attr('minx'), $bbox.attr('maxy')].map(parseFloat)
				]], 'XY')
			}) : null;

			var extent = $bbox.length ? [
				$bbox.attr('minx'), $bbox.attr('miny'),
				$bbox.attr('maxx'), $bbox.attr('maxy')].map(parseFloat) : null;

			// Ugly side-effect implementation
			layers[$feature.find('Title').text()] = new ol.layer.Vector({
				id: $feature.find('Title').text(),
				name: $feature.find('Title').text(),
				bbox: bbox,
				extent: extent,
				source: new ol.source.Vector({
					loader: function(extent, resolution, projection) {
						$.ajax('http://geoportaal.fryslan.nl/arcgis/services/ProvinciaalGeoRegister/PGR_features/GeoDataServer/WFSServer', {
							type: 'GET',
							crossdomain: true,
							data: {
								service: 'WFS',
								version: '1.0.0',
								request: 'GetFeature',
								typename: $feature.find('Name').text(),
								srsname: 'EPSG:28992', // todo: get this info from $feature?
								bbox: extent.join(',')
							}
						}).done(function(data) {
							var format = new ol.format.GML2();
							this.addFeatures(format.readFeatures(data));
						}.bind(this));
					},
					strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
						maxZoom: 19
					})),
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
	}).get();

	// Add a debug map that contains all the extents of the just fetched WFS
	layers['FryslanWFS'] = new ol.layer.Vector({
		id: 'FryslanWFS',
		name: '#Fryslan WFS extents',
		source: new ol.source.Vector({
			features: features,
			strategy: ol.loadingstrategy.tile(ol.tilegrid.createXYZ({
				maxZoom: 19
			})),
			projection: 'EPSG:28992',
			attributions: [new ol.Attribution({
				html: 'Feature bboxes'
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
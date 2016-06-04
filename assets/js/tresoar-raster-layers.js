Viewer.loaders.WMS = function(options, viewer) {
	var ns = {
		wms: 'http://www.opengis.net/wms'
	};
	
	function getChildNodesByTagName(parent, nodeName) {
		return $.makeArray(parent.childNodes).filter(function(child) {
			return child.nodeType == parent.ELEMENT_NODE
				&& child.nodeName == nodeName;
		});
	}

	return $.ajax(options.url, {
		type: 'GET',
		dataType: 'xml',
		data: {
			request: 'GetCapabilities',
			namespace: 'tresoar'
		}
	}).done(function(data) {
		var wmsLayers = $.makeArray(data.getElementsByTagName('Layer')).map(function(layer) {
			var $layer = $(layer);

			var $bbox = getChildNodesByTagName(layer, 'BoundingBox').find(function(el) {
				return el.hasAttribute('SRS') && el.getAttribute('SRS') == 'EPSG:28992'
					|| el.hasAttribute('CRS') && el.getAttribute('CRS') == 'EPSG:28992';
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

			var name = getChildNodesByTagName(layer, 'Name')[0].textContent;
			var title = getChildNodesByTagName(layer, 'Title')[0].textContent;

			var layer = new ol.layer.Tile({
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
					width: Viewer.EPSG28992.tileGrid.getTileSize()[0],
					height: Viewer.EPSG28992.tileGrid.getTileSize()[1],
					tiled: true,
					bbox: bbox.getGeometry().getExtent().join(',')
				}),
				source: new ol.source.TileWMS({
					url: options.url,
					attributions: options.attributions,
					crossOrigin: 'anonymous',
					params: {
						LAYERS: name,
						TILED: true,
						TRANSPARENT: false,
						FORMAT: 'image/jpeg',
						SRS: 'EPSG:28992'
					},
					projection: Viewer.EPSG28992,
					tileGrid: Viewer.EPSG28992.tileGrid,
					tileLoadFunction: function(imageTile, src) {
						var image = new Image();
						image.crossOrigin = 'anonymous';
						image.onload = function() {
							var canvas = document.createElement('canvas');
							canvas.width = image.width;
							canvas.height = image.height;

							var context = canvas.getContext('2d');
							context.drawImage(image, 0, 0);

							var imageData = context.getImageData(0, 0, image.width, image.height);
							var pixels = imageData.data;

							for (var i = 0, n = pixels.length; i <n; i += 4) {
								var r = pixels[i], g = pixels[i+1], b = pixels[i+2];
								// Make white pixels transparent. Difficult due to jpeg artifacts :(
								// TODO: Replace this with some form of flood fill and tolerance
								// but take into account that we may not be at an edge tile!
								if (r > 250 && g > 250 && b > 250) {
									pixels[i+3] = 0;
								}
							}

							context.putImageData(imageData, 0, 0);

							imageTile.getImage().src = canvas.toDataURL('image/png');
						};

						// Start loading the source image
						image.src = src;
					}
				})
			});

			// Even though we pass TRANSPARENT=FALSE, we still want OL to think
			// of this layer as transparent since we'll be making some of the
			// pixels transparent :D
			layer.getSource().opaque_ = false;

			// Ugly side-effect implementation
			viewer.addLayer(layer);

			return bbox;
		});
	});
};
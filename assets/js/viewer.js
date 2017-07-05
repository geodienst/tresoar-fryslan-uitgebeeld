(function() {
	var ContextMenu = function(opt_options) {
		var options = opt_options || {};

		var element = document.createElement('ul');
		element.className = 'context-menu dropdown-menu';

		$(document.body).on('mousedown', function(e) {
			if (!$.contains(element, e.target)) {
				$(element).hide();
			}
		});
		
		ol.control.Control.call(this, {
		  element: element,
		  target: options.target
		});
	};

	ol.inherits(ContextMenu, ol.control.Control);

	ContextMenu.prototype.clear = function() {
		$(this.element).empty();
	}

	ContextMenu.prototype.addItem = function(label, href) {
		return $('<a>')
			.text(label)
			.attr('href', href || '#')
			.appendTo($('<li>').appendTo(this.element));
	}

	ContextMenu.prototype.show = function(position) {
		var viewport = {
			width: $(this.getMap().getViewport()).width(),
			height: $(this.getMap().getViewport()).height()
		};

		var size = {
			width: $(this.element).width(),
			height: $(this.element).height()
		};

		// If it doesnt fit on the right, move it to the left
		if (position[0] + size.width > viewport.width)
			position[0] -= size.width;

		// If it would be larger than the viewport bottom, move it up a bit
		if (position[1] + size.height > viewport.height)
			position[1] = viewport.height - (size.height + 20);

		$(this.element).css({
			left: position[0] + 'px',
			top: position[1] + 'px',
			display: 'block'
		});
	}

	ContextMenu.prototype.hide = function() {
		$(this.element).hide();
	}

	var Viewer = function(config) {
		this.config = config;
		this.initialize();
	};

	Viewer.loaders = {};

	proj4.defs("EPSG:28992", "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 \
		+k=0.9999079 +x_0=155000 +y_0=463000  +ellps=bessel  \
		+towgs84=565.040,49.910,465.840,-0.40939,0.35971,-1.86849,4.0772 \
		+units=m +no_defs");

	var EPSG28992 = new ol.proj.Projection({
		code: 'EPSG:28992'
	});

	ol.proj.addProjection(EPSG28992);

	var projectionExtent = [-285401.92,22598.08,595401.9199999999,903401.9199999999];
	var resolutions = [3440.64, 1720.32, 860.16, 430.08, 215.04, 107.52, 53.76, 26.88, 13.44, 6.72, 3.36, 1.68, 0.84, 0.42, 0.21, 0.105, 0.0525, 0.02625, 0.013125];
	
	Viewer.EPSG28992 = EPSG28992;

	Viewer.EPSG28992.extent = projectionExtent;
	Viewer.EPSG28992.resolutions = resolutions;
	Viewer.EPSG28992.tileGrid = new ol.tilegrid.WMTS({
		origin: ol.extent.getTopLeft(projectionExtent),
		resolutions: resolutions,
		matrixIds: resolutions.map(function(resolution, index) { return 'EPSG:28992:' + index; }),
		tileSize: [512, 512]
	});

	Viewer.EPSG28992.tileGrid256 = new ol.tilegrid.WMTS({
		origin: ol.extent.getTopLeft(projectionExtent),
		resolutions: resolutions,
		matrixIds: resolutions.map(function(resolution, index) { return 'EPSG:28992:' + index; }),
		tileSize: [256, 256]
	});

	var geodienstAttribution = new ol.Attribution({
		html: '<a href="http://www.geodienst.xyz/" target="_blank">Viewer: Geodienst</a>'
	});

	Viewer.prototype.initialize = function() {
		var viewer = this;

		this._isRestoringState = true;
		
		$.when.apply(null,
			this.config.sources.map(function(source) {
				return Viewer.loaders[source.type](source, viewer);
			}))
			.then(function() {
				if (document.location.hash.length > 1)
					viewer.fromURL(document.location.hash.substr(1));
			});

		// FIXME it would be more awesome if we could retrieve this list (excl the base layers)
		// from Geoserver directly (through GetCapabilities?)

		this.animationDuration = 300;

		this.layers = {};

		this.layerExtents = {};

		this.contextMenu = new ContextMenu();

		this.map = new ol.Map({
			layers: [
				new ol.layer.Vector({
					id: 'internal:nederland',
					source: new ol.source.Vector({
						loader: function(extent, resolution, projection) {
							$.ajax('provinces.geojson', {
								type: 'GET',
								dataType: 'json'
							}).done(function(data) {
								var format = new ol.format.GeoJSON();
								this.addFeatures(format.readFeatures(data, {
									dataProjection: 'EPSG:4326',
									featureProjection: 'EPSG:28992'
								}));
							}.bind(this));
						},
						projection: 'EPSG:28992'
					}),
					style: new ol.style.Style({
						stroke: new ol.style.Stroke({
							color: [0, 0, 0, 0.15],
							width: 1
						})
					})
				})
			],
			target: $('#map').get(0),
			maxResolution: 860.16,
			numZoomLevels: 12,
			units: 'm',
			theme: null,
			displayProjection: EPSG28992,
			view: new ol.View({
				projection: EPSG28992,
				center: [194898.97512816024, 572819.4255151745], // Center on Fryslân!
				extent: [7624.23727, 305942.69072, 285769.01916, 625595.51780], // OpenTopo extent
				maxZoom: 18,
				minZoom: 8,
				zoom: 10.5
			}),
			controls: ol.control.defaults({
				attribution: true,
				attributionOptions: {
					collapsed: false,
					render: function(mapEvent) {
						// Add the Geodienst attribution, which is not connected to a specific source
						mapEvent.frameState.attributions.geodienst = geodienstAttribution;
						ol.control.Attribution.render.call(this, mapEvent);
					}
				}
			}).extend([
				new ol.control.ScaleLine(),
				this.contextMenu
			])
		});

		// Update the layer list every time a layer is enabled or disabled
		this.map.getLayers().on('add', this.triggerUpdateLayerList.bind(this));
		this.map.getLayers().on('remove', this.triggerUpdateLayerList.bind(this));

		// Update the state encoded in the current URL
		this._updatePermalink = throttle(this.updatePermalink.bind(this), 250);
		this.map.getLayers().on(['add', 'remove'], this._updatePermalink);
		this.map.getView().on(['change:center', 'change:resolution'], this._updatePermalink);
		
		this.$activeLayers = $('#active-layers');

		// Enable Bootstrap tooltips in the dynamic #layers list
		$('#layers').tooltip({
			container: 'body',
			selector: '[data-toggle="tooltip"]',
			delay: {
				show: 500,
				hide: 0
			},
			title: function() {
				return $(this).attr('data-tooltip') || $(this).attr('title');
			}
		});

		// Using https://johnny.github.io/jquery-sortable/ to make the active layer list orderable
		var adjustment;
		$('#active-layers').sortable({
			group: 'layers',
			onMousedown: function ($item, _super, event) {
				if (!event.target.nodeName.match(/^(input|select|textarea|button)$/i)) {
					event.preventDefault()
					return true
				}
			},
			// set $item relative to cursor position
			onDragStart: function ($item, container, _super) {
				var pointer = container.rootGroup.pointer;
				var position  = $item.offset();
				adjustment = {
					left: pointer.left - position.left,
					top: pointer.top - position.top
				};

				$item.css({
					width: $item.outerWidth(),
					height: $item.outerHeight()
				});

				$item.appendTo(document.body);

				_super($item, container);
			},
			onDrag: function ($item, position) {
				$item.css({
					left: position.left - adjustment.left,
					top: position.top - adjustment.top,
				});
			},
			onDrop: function($item, container, _super) {
				// $item.appendTo(container);
				$item.css({
					width: null,
					height: null
				});
				viewer.updateLayerZOrder();
				_super($item, container);
			},
			serialize: function (parent, children, isContainer) {
				return isContainer ? children.join() : parent.attr('data-layer-id');
			},
		});
		
		this.featureOverlay = new ol.layer.Vector({
			map: this.map,
			source: new ol.source.Vector({
				features: new ol.Collection(),
				useSpatialIndex: false
			}),
			style: new ol.style.Style({
				stroke: new ol.style.Stroke({
					color: 'red',
					width: 2
				}),
				fill: new ol.style.Fill({
					color: [255, 0, 0, 0.25]
				})
			}),
			updateWhileAnimating: true,
			updateWhileInteracting: true
		});

		// Add layer button
		$('#layers').on('click', '.add-layer-button', function(e) {
			var layerId = $(this).attr('data-layer-id');
			var layer = viewer.layers[layerId];

			// Remove the bounding box overlay if that is still shown
			viewer.removeLayerOutline(layerId);

			// Move the layer to the top
			layer.setZIndex(viewer.map.getLayers().getArray().length);

			// Make layer fully visible
			layer.setOpacity(1.0);
			
			// Add the layer to the map
			viewer.map.addLayer(layer);
		});

		// Remove layer button
		$('#layers').on('click', '.remove-layer-button', function(e) {
			var layerId = $(this).closest('.layer').attr('data-layer-id');
			var layer = viewer.layers[layerId];
			viewer.removeLayerOutline(layerId);
			viewer.map.removeLayer(layer);
		});

		// Focus layer on double click
		$('#layers').on('dblclick', '#active-layers .layer', function(e) {
			e.preventDefault();

			var layerId = $(this).closest('.layer').attr('data-layer-id');
			var feature = viewer.layerExtents[layerId];

			if (feature === undefined)
				return;

			// Zoom & pan to the feature
			viewer.map.getView().fit(feature.getGeometry(), viewer.map.getSize(), {
				maxZoom: 16,
				padding: [10, 10, 10, 10],
				duration: viewer.animationDuration
			});
		});

		// Change layer opacity slider
		$('#layers').on('change', '.layer input[name=opacity]', function(e) {
			var layerId = $(this).closest('.layer').attr('data-layer-id');
			viewer.layers[layerId].setOpacity(this.value / 100);
		});

		// Outline of map when hovering over a layer in the sidebar
		$('#layers').on('mouseover', '.layer', function(e) {
			var layerId = $(this).attr('data-layer-id');
			viewer.addLayerOutline(layerId);
		});

		$('#layers').on('mouseout', '.layer', function(e) {
			var layerId = $(this).attr('data-layer-id');
			viewer.removeLayerOutline(layerId);
		});

		var groupCollapsed = {};

		// Layer group collapsing
		$('#layers').on('click', '.group-toggle', function(e) {
			var groupEl = $(this).closest('[data-group-id]');
			var groupId = groupEl.attr('data-group-id');
			var visible = !groupCollapsed[groupId];

			groupEl.attr('data-collapsed', visible ? 'collapsed' : '');
			groupCollapsed[groupId] = visible;
		});

		// Layer searching
		$('#layer-filter-query').on('keyup', this.scheduleUpdateLayerList.bind(this));

		$('#layers .layer-filter').on('submit', function(e) {
			e.preventDefault();
			viewer.triggerUpdateLayerList()
		});

		$('#layers .layer-filter').on('reset', function(e) {
			$('#layer-filter-query').val('');
			viewer.triggerUpdateLayerList();
		});

		// Feature popup
		this.popup = $('#feature-popup');

		// Enable the close button of the popup
		this.popup.find('.close').on('click', function(e) {
			e.preventDefault();
			viewer.hideFeaturePopup();
		});

		this.hoverStyle = new ol.style.Style({
			stroke: new ol.style.Stroke({
				color: 'red',
				width: 2
			}),
			fill: new ol.style.Fill({
				color: [0, 0, 255, 0.6]
			})
		});

		// When we hover over a menu item in the feature selector, highlight that feature!
		$(viewer.contextMenu.element)
			.on('mouseover', 'a', function(e) {
				var feature = $(this).data('feature');
				// Points are clustered, and changing their style causes a change event which
				// will trigger a complete reclustering...
				if (feature.feature.getGeometry() instanceof ol.geom.Point)
					return;
				
				feature.feature.setStyle(viewer.hoverStyle);
			})
			.on('mouseout', 'a', function(e) {
				var feature = $(this).data('feature');
				if (feature.feature.getGeometry() instanceof ol.geom.Point)
					return;
				feature.feature.setStyle(null);
			})
			.on('click', 'a', function(e) {
				e.preventDefault();
				var feature = $(this).data('feature');
				viewer.hideFeatureSelector();
				viewer.showFeaturePopup(feature);
			});


		// Make the cursor a pointer for anything clickable, but only after a small delay because
		// calling the hasFeatureAtPixel function *during* mouse movement is very, very expensive.
		var updatePointerTimeout;
		this.map.on('pointermove', function(e) {
			viewer.map.getTarget().style.cursor = '';
			
			clearTimeout(updatePointerTimeout);
			updatePointerTimeout = setTimeout(function() {
				var pixel = viewer.map.getEventPixel(e.originalEvent);
				var hit = viewer.map.hasFeatureAtPixel(pixel, {layerFilter: viewer.layerFilter.bind(viewer)});
				viewer.map.getTarget().style.cursor = hit ? 'pointer' : '';
			}, 50);
		});

		// When clicking on the map, we might click a feature!
		this.map.on('click', function(evt) {
			var features = [];

			viewer.map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
				if (!layer) return null;
				// If the feature is a clustering feature which is just a proxy for a
				// set of real features, add the real features to the list instead of
				// the cluster.
				if ('features' in feature.getProperties())
					feature.getProperties().features.map(function(feature) {
						features.push({feature: feature, layer: layer});
					});
				else
					features.push({feature: feature, layer: layer});
			}, {
				layerFilter: viewer.layerFilter.bind(viewer)
			});

			if (features.length === 1) {
				viewer.showFeaturePopup(features[0], evt);
			} else if (features.length > 1) {
				viewer.hideFeaturePopup();
				viewer.showFeatureSelector(features, evt.pixel);
			}
		});

		// Update the layer list when zooming or panning
		this.map.getView().on(['change:center', 'change:resolution'],
			this.scheduleUpdateLayerList.bind(this));

		this.sidebar = new Sidebar(this, $('#layers'), $('#map'));

		this.layerList = new LayerList({
			rootNode: $('#available-layers'),
			listItemClass: LayerGroup,
			key: function(group) {
				return group.name;
			}
		});

		// Update the layer list now
		this.triggerUpdateLayerList();

		this._isRestoringState = false;
	};

	Viewer.prototype.addLayerOutline = function(layerId) {
		if (this.layerExtents[layerId] !== undefined)
			this.featureOverlay.getSource().addFeature(this.layerExtents[layerId]);
	};

	Viewer.prototype.removeLayerOutline = function(layerId) {
		try {
			if (this.layerExtents[layerId] !== undefined)
				this.featureOverlay.getSource().removeFeature(this.layerExtents[layerId]);
		} catch (e) {
			// Apparently it was already removed
		}
	}

	Viewer.prototype.addLayer = function(layer) {
		layer.on(['change:zIndex', 'change:opacity'], this._updatePermalink);
		this.layers[layer.get('id')] = layer;

		if (this.layerExtents[layer.get('id')] === undefined)
			this.layerExtents[layer.get('id')] = layer.get('bbox');

		this.scheduleUpdateLayerList();
	};

	Viewer.prototype.updateLayerZOrder = function() {
		var viewer = this;
		var $layers = this.$activeLayers.find('.layer');
		$layers
			.map(function() { return $(this).prop('data-layer-id'); })
			.each(function(i) { viewer.layers[this].setZIndex($layers.length - 1 - i); });
	};

	Viewer.prototype.layerFilter = function(layer) {
		return !/^internal:/.test(layer.get('id'));
	};

	function getSurface(extent) {
		var size = ol.extent.getSize(extent);
		return size[0] * size[1];
	}

	// Render the list of layers (using Transparency.js templating)
	Viewer.prototype.updateLayerList = function() {
		var activeLayerIds = this.map.getLayers().getArray()
			.filter(this.layerFilter)
			.map(function(layer) { return layer.get('id'); });

		// Hide all tooltips before refreshing the list because sometimes the element
		// a tooltip was connected to is removed, and then there is no onmouseout-event
		// left to hide the tooltip :(
		$('#layers [data-toggle="tooltip"]').tooltip('hide');

		// Hide the overlays, because otherwise we might miss onmouseout events
		this.featureOverlay.getSource().clear();

		this.$activeLayers.render(
			this.map.getLayers().getArray()
			.filter(this.layerFilter)
			// Extract all the attributes we want to render from the layers
			.map(function(layer) {
				return {
					layer: {
						'id': layer.get('id'),
						'z-index': layer.getZIndex(),
						'layer-name': layer.get('name'),
						'opacity': layer.getOpacity() * 100
					}
				};
			})
			// Sort the layers by their z-index
			.sort(function(a, b) {
				return b['layer']['z-index'] - a['layer']['z-index'];
			}),
			{ // directives on how to render this stuff
				'layer': {
					'data-layer-id': function() {
						return this.layer.id;
					},
				},
				'remove-layer-button': {
					'data-tooltip': function() {
						return 'Verplaats ' + this.layer['layer-name'] + ' terug naar \'Beschikbare lagen\'';
					}
				}
			}
		);

		// Layers are rendered with the top-most in the list as the top-most in the view
		// (Transpacenry template rendering does not take order into account, probably
		// because sortable() screws up some internal model of the siblings.)
		this.$activeLayers.find('.layer')
			.sort((function(a, b) {
				return this.layers[$(b).attr('data-layer-id')].getZIndex()
					 - this.layers[$(a).attr('data-layer-id')].getZIndex(); 
			}).bind(this))
			.detach()
			.appendTo('#active-layers');

		var visibleExtent = this.map.getView().calculateExtent(this.map.getSize());

		var query = $('#layer-filter-query').val().toLowerCase();

		// Turn the list of layers into a selection of info about the raster layers, to be rendered in the list.
		var rasterLayers = $.map(this.layers, function(layer) {
			// If the layer is already on the map, hide it in the available list
			if (activeLayerIds.indexOf(layer.get('id')) >= 0)
				return null;

			switch (layer.constructor) {
				case ol.layer.Tile:
					var type = 'raster';
					break;
				case ol.layer.Vector:
					var type = 'vector';
					break;
				default:
					var type = 'undefined';
					break;
			}

			var visibility, coverage, score = 0;

			if (query != '') {
				score = layer.get('name').score(query, 0.3);

				// If the score is pretty low, don't even show it at all
				if (score < 0.1)
					return null;
			} else if (layer.getExtent()) {
				var layerExtent = layer.getExtent();

				if (this.layerExtents[layer.get('id')] !== undefined)
					layerExtent = this.layerExtents[layer.get('id')].getGeometry().getExtent();

				// Which part of the layer's extent is currently in the view? 
				var layerVisibleExtent = ol.extent.getIntersection(layerExtent, visibleExtent);

				// Only show layers that are inside the view
				if (ol.extent.isEmpty(layerVisibleExtent))
					return null;
				
				// Visibility: How much of the map would be visible in the current view
				visibility = getSurface(layerVisibleExtent) / getSurface(layer.getExtent());

				// Coverage: How much of the current view would be filled in by the map
				coverage = getSurface(layerVisibleExtent) / getSurface(visibleExtent);
				
				score = visibility * coverage;
			}
			
			return {
				'id': layer.get('id'),
				'name': layer.get('name'),
				'thumbnail': layer.get('thumbnail'),
				'type': type,
				'visibility': visibility,
				'coverage': coverage,
				'score': score
			};
		}.bind(this));

		// sort layers in size (smaller on top)
		rasterLayers = rasterLayers.sort(function(a, b) {
			if (a.score != b.score)
					return b.score - a.score;
				else
					return a.name.localeCompare(b.name);
		});

		// group layers by group as defined by window.groups (or groups.json indirectly)
		rasterLayers = rasterLayers.reduce((function(prev, current) {
			// Find the right group
			var group = this.config.groups.find(function(group) {
				return group.pattern.test(current.id);
			});

			// No group? Skip map completely right now
			if (!group)
				return prev;

			// Otherwise add map to the combined groups element
			if (prev[group.name] === undefined)
				prev[group.name] = {
					name: group.name,
					layers: [current]
				};
			else
				prev[group.name].layers.push(current);

			return prev;
		}).bind(this), {});

		// turn the object (map-like structure) back to an array of values (groups)
		rasterLayers = $.map(rasterLayers, function(layer) {
			return layer;
		});

		// sort the groups again using the order defined in the config
		rasterLayers = rasterLayers.sort((function(a, b) {
			var ai, bi;
			
			for (var i = 0; i < this.config.groups.length; ++i) {
				if (this.config.groups[i].name == a.name)
					ai = i;
				if (this.config.groups[i].name == b.name)
					bi = i;
			}

			return ai - bi;
		}).bind(this));

		this.layerList.render(rasterLayers);
	}

	Viewer.prototype.debugExtentCoverage = function() {
		/* Returns all layers that have a default extent instead of a pretty one */
		return Object.values(this.layers)
			.reduce((function(acc, layer) {
				return this.layerExtents[layer.get('id')] === layer.get('bbox') ? acc.concat([layer]) : acc;
			}).bind(this), []);
	}	

	// Scheduling and triggering layer list updates. Please use schedule
	// as much as possible for example while panning the map or typing in
	// the search field. It will delay the actual update while the user
	// is still entering new data. triggerUpdateLayerList will clear the
	// scheduled update and run immediately. use this instead of 
	// updateLayerList directly to prevent updating the list, and then
	// update the list again when the scheduled update is fired.

	var layerListTimeout;

	Viewer.prototype.scheduleUpdateLayerList = function() {
		clearTimeout(layerListTimeout);
		layerListTimeout = setTimeout(this.triggerUpdateLayerList.bind(this), 500);
	}

	Viewer.prototype.triggerUpdateLayerList = function() {
		clearTimeout(layerListTimeout);
		this.updateLayerList();
	}

	Viewer.prototype.updatePermalink = function() {
		if (!this._isRestoringState)
			window.history.replaceState(null, document.title, '#' + this.toURL());
	}

	Viewer.prototype.toURL = function() {
		var data = {
			layers: this.map.getLayers().getArray()
				.filter(this.layerFilter)
				.sort(function(a, b) { return b.getZIndex() - a.getZIndex(); })
				.map(function(layer) { return layer.get('id') + '@' + layer.getOpacity(); })
				.join(';'),
			center: this.map.getView().getCenter().join(','),
			resolution: this.map.getView().getResolution()
		};

		return Object.keys(data).map(function(key) {
			return key + '=' + encodeURIComponent(data[key]);
		}).join('&');
	}

	Viewer.prototype.fromURL = function(url) {
		try {
			this._isRestoringState = true;
			
			var components = {};
			url.split('&').forEach(function(part) {
				var pair = part.split('=', 2);
				components[pair[0]] = decodeURIComponent(pair[1]);
			});

			var viewer = this;
			var layers = this.map.getLayers();
			var view = this.map.getView();
			
			var layerComponents = components.layers.split(';');
			
			// Remove all layers active at the moment
			this.map.getLayers().getArray().filter(this.layerFilter).forEach(layers.remove.bind(layers));

			// Add all the layers with the correct z-index and opacity to the view.
			layerComponents
				.map(function(layerComponent, index) {
					var info = layerComponent.split('@', 2);
					var layer = viewer.layers[info[0]];
					if (!layer) return null;
					layer.setOpacity(parseFloat(info[1]));
					layer.setZIndex(layerComponents.length - index);
					return layer;
				})
				.filter(function(layer) {
					return layer !== null;
				})
				.forEach(layers.push.bind(layers));

			if (components.center)
				view.setCenter(components.center.split(',',2).map(function(v) { return parseFloat(v); }));

			if (components.resolution)
				view.setResolution(parseFloat(components.resolution));
		} finally {
			this._isRestoringState = false;
		}
	}

	Viewer.prototype.defaultFeatureFilter = {
		header: function(feature) {
			var props = feature.getProperties();
			var options = ['naam', 'name'];
			for (var i = 0; i < options.length; ++i) {
				if (props[options[i]] !== undefined) {
					return props[options[i]];
				}
			}

			return null;
		},
		content: function(feature) {
			return $.Deferred().resolve(
				$.map(feature.getProperties(), function(v, k) {
					// Skip these default attributes that are boring
					if (/SHAPE.*|GLOBALID|OBJECTID|the_geom/.test(k))
						return null;

					return {key: k, value: v};
				}).toHTMLTable());
		}
	};

	Viewer.prototype.getFeatureHeader = function(feature, layer) {
		var featureFilter = this.config.properties.find(function(property_set) {
			return new RegExp(property_set.pattern).test(layer.get('id'));
		}) || this.defaultFeatureFilter;

		return featureFilter.header(feature);
	}

	Viewer.prototype.showFeaturePopup = function(feature, evt) {
		if (!feature.layer)
			return null;
		
		// Find a feature filter in the config				
		var featureFilter = this.config.properties.find(function(property_set) {
			return new RegExp(property_set.pattern).test(feature.layer.get('id'));
		}) || this.defaultFeatureFilter;

		var $popup = this.popup;
		$popup.addClass('ui-loading');
		featureFilter.header(feature.feature).done(function(title) {
			$popup.find('.popover-title').text(title);
		});

		featureFilter.content(feature.feature)
			.always(function() {
				$popup.removeClass('ui-loading');
				$popup.find('.popover-content').empty();
			})
			.done(function(content) {
				$popup.find('.popover-content').append(content);
			})
			.fail(function() {
				var $error = $('<p>').addClass('text-info').text('De extra informatie kon niet worden opgehaald.');
				$popup.find('.popover-content').append($error);
			});

		this.popup.show();

		// if we still have a reset listener listening, cancel it now
		if (this.prePopupState && this.prePopupState.resetListenerKey !== null)
			this.map.getView().unByKey(this.prePopupState.resetListenerKey);

		// Prepare the new popup-state (where we switch to when we close the popup)
		this.prePopupState = {
			feature: feature,
			center: this.prePopupState ? this.prePopupState.center : this.map.getView().getCenter(),
			resolution: this.prePopupState ? this.prePopupState.resolution : this.map.getView().getResolution(),
			resetListenerKey: null
		};

		// Prepare a new reset listener: this clears the prePopupState when you start zooming or
		// panning manually. In this case we do want to close the popup, but we don't want the
		// map to zoom back to its original state (as that would mess with the current interaction
		// of the user!)
		var registerResetPopupState = (function() {
			this.prePopupState.resetListenerKey = this.map.getView().on(['change:center', 'change:resolution'], function(e) {
				// For some reason change:center is also called when you click another feature instead of
				// actually panning. But then the center isn't changed, and we can test for that.
				if (e.key == 'center' && e.oldValue.toString() == this.map.getView().getCenter().toString())
					return;
				
				// When they do, hide the feature popup, but make sure
				// that we don't take over control of the panning and zooming.				
				this.map.getView().unByKey(this.prePopupState.resetListenerKey);
				this.prePopupState = null;
				this.hideFeaturePopup();
			}.bind(this));
		}).bind(this);

		// Monkey-patch ol.View.animate (which will be called by ol.View.fit) to call
		// a the registerResetPopupState callback (because I can't pass that to ol.View.fit)
		this.map.getView().animate = function(options) {
			return ol.View.prototype.animate.call(this, options, registerResetPopupState);
		};

		// Zoom & pan to the feature
		this.map.getView().fit(feature.feature.getGeometry(), this.map.getSize(), {
			maxZoom: Math.max(16, this.map.getView().getZoom()),
			padding: [50, this.popup.width(), 10, 10],
			duration: this.animationDuration
		});

		// Undo our monkey patch
		delete this.map.getView().animate;
	};

	Viewer.prototype.hideFeaturePopup = function() {
		if (!this.popup.is(':visible'))
			return;

		this.popup.hide();

		// Animate the reset of the resolution
		if (this.prePopupState)
		{
			// Saving a local copy, because as soon as we start panning,
			// the reset listener is called and prePopupState is gone!
			var prePopupState = this.prePopupState;
			this.prePopupState = null;

			// If we still have a reset listener listening in, cancel that.
			if (prePopupState.resetListenerKey)
				this.map.getView().unByKey(prePopupState.resetListenerKey);

			this.map.getView().animate({
				center: prePopupState.center,
				resolution: prePopupState.resolution,
				duration: this.animationDuration
			});
		}
	};

	Viewer.prototype.showFeatureSelector = function(features, position) {
		var viewport = {
			width: $(this.map.getViewport()).width(),
			height: $(this.map.getViewport()).height()
		};

		this.contextMenu.clear();

		features.forEach(function(feature) {
			var $item = this.contextMenu.addItem('Loading…').data('feature', feature);
			this.getFeatureHeader(feature.feature, feature.layer).done(function(header) {
				$item.text(header || '[Geen label]');
				$item.prop('title', header);
			});
		}.bind(this));

		this.contextMenu.show(position);

		// var offset = $popup.offset();

		// var size = {
		// 	width: $popup.width(),
		// 	height: $popup.height()
		// };

		// var xPositioning = offset.left + size.width > viewport.width ? 'right' : 'left';

		// if (offset.top + 0.5 * size.height > viewport.height)
		// 	var yPositioning = 'bottom';
		// else if (offset.top + size.height > viewport.height)
		// 	var yPositioning = 'center';
		// else
		// 	var yPositioning = 'top';
		
		// this.featureSelectionMenu.setPositioning(yPositioning + '-' + xPositioning);
	};

	Viewer.prototype.hideFeatureSelector = function() {
		this.contextMenu.hide();
	};

	Viewer.prototype.addLayerExtents = function(features) {
		features.forEach(function(feature) {
			this.layerExtents[feature.get('layer')] = feature;
		}.bind(this));
	};

	Viewer.prototype.extentAsFeature = function(extent) {
		var polygon = new ol.geom.Polygon([[
			[extent[0], extent[1]],
			[extent[2], extent[1]],
			[extent[2], extent[3]],
			[extent[0], extent[3]]
			]], 'XY');
		return new ol.Feature({geometry: polygon});
	};

	Viewer.prototype.currentViewAsFeature = function() {
		var extent = this.map.getView().calculateExtent(this.map.getSize());
		return this.extentAsFeature(extent);
	};

		

		// map.getView().on('change:resolution', function() {
		// 	console.log(this.getResolution());
		// });

		// Map extents for discoverability
		/*
		var extendsOverlay = new ol.layer.Vector({
			map: map,
			source: new ol.source.Vector({
				loader: function(extent, resolution, projection) {
					$.ajax('http://localhost:8080/geoserver/ows', {
						type: 'GET',
						data: {
							service: 'WFS',
							version: '1.0.0',
							request: 'GetFeature',
							typename: 'tresoar:extents'
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
					color: 'red',
					width: 2
				})
			})
		});
		*/

	function AvailableLayer() {
		this.$button = $('<button type="button">');
		this.$button.addClass('layer add-layer-button list-group-item');
		this.$button.attr({
			'data-toggle': 'tooltip',
			'data-placement': 'right'
		});

		this.$thumbnail = $('<img width="256" height="256">');
		this.$thumbnail.addClass('thumbnail');

		this.$thumbnailContainer = $('<div>').addClass('thumbnail-container');
		this.$thumbnailContainer.append(this.$thumbnail);

		this.$name = $('<span>').addClass('name');

		this.$button.append(this.$thumbnailContainer, this.$name);
	}

	AvailableLayer.prototype.render = function(layer) {
		this.$button.attr({
			'data-layer-id': layer.id,
			'data-tooltip': 'Voeg \'' + layer.name + '\' toe aan de zichtbare lagen',
			'data-score-visibility': layer.visibility,
			'data-score-coverage': layer.coverage,
			'data-score': layer.score
		});

		if (layer.thumbnail) {
			if (this.$thumbnail.attr('src') != layer.thumbnail) {
				this.$thumbnail.attr('src', layer.thumbnail);
				this.$thumbnailContainer.show();
			}
		}
		else
			this.$thumbnailContainer.hide();

		this.$name.text(layer.name);

		return this.$button;
	}

	function LayerList(options) {
		this.$rootNode = $(options.rootNode);
		this.listItemClass = options.listItemClass;
		this.key = options.key;
		this.listItems = {};
	}

	LayerList.prototype.render = function(listItems) {
		this.$rootNode.children().detach();

		this.$rootNode.append(
			listItems.map(function(listItem) {
				var key = this.key(listItem);
				if (!(key in this.listItems))
					this.listItems[key] = new this.listItemClass();

				return this.listItems[key].render(listItem);
			}.bind(this))
		);

		return this.$rootNode;
	}

	function LayerGroup() {
		this.$div = $('<div>').addClass('layer-group');
		
		this.$groupName = document.createTextNode('{Group name}');
		this.$layerCount = document.createTextNode('0');

		var $header = $('<h4>').addClass('layer-group-header');

		var $layerCountBadge = $('<span>').addClass('layer-group-count badge').append(this.$layerCount);

		var $toggle = $('<button>').addClass('group-toggle').append(
			$('<span>').addClass('glyphicon glyphicon-minus'));

		$header.append(this.$groupName, $layerCountBadge, $toggle);

		var $layerList = $('<div>').addClass('layers list-group');

		this.layerList = new LayerList({
			rootNode: $layerList,
			listItemClass: AvailableLayer,
			key: function(layer) {
				return layer.id;
			}
		});

		this.$div.append($header, $layerList);
	}

	LayerGroup.prototype.render = function(group) {
		this.$div.attr({'data-group-id': group.name});
		this.$groupName.textContent = group.name;
		this.$layerCount.textContent = group.layers.length;
		this.layerList.render(group.layers);
		return this.$div;
	}

	function Sidebar(viewer, $layers, $map)
	{
		var pos;
		var width;

		var setLayerPanelWidth = function(width) {
			width = Math.max(Math.min(width, 500), 100);
			$layers.width(width)
			$map.css('left', width);
			viewer.map.updateSize();
			window.localStorage['layerPanelWidth'] = width;
		}

		$layers.find('.resize-handle').on('mousedown', function(e) {
			pos = e.clientX;
			width = $('#layers').width();
			e.preventDefault();
		});

		$(document.body).on('mouseup', function(e) {
			if (pos !== null) {
				pos = null;
				e.preventDefault();
			}
		});

		$(document.body).on('mousemove', function(e) {
			if (pos !== null) {
				setLayerPanelWidth(width + (e.clientX - pos));
				e.preventDefault();
			}
		});

		if (window.localStorage['layerPanelWidth'] !== undefined)
			setLayerPanelWidth(window.localStorage['layerPanelWidth']);
	}

	window.Viewer = Viewer;
})();
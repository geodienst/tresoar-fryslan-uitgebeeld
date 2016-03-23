// Feature popup
var popup = new ol.Overlay({
	element: $('#feature-popup').detach().get(0),
	positioning: 'center-left',
	stopEvent: true
});

map.addOverlay(popup);

jQuery.fn.atPoint = function(point) {
	return $(this).filter(function() {
		var offset = $(this).offset(),
			width = $(this).width(),
			height = $(this).height();

		return offset.top <= point.y && offset.top + height >= point.y
			&& offset.left <= point.x && offset.left + width >= point.x;
	});
}

function featureLabel(feature) {
	var props = feature.getProperties();
	var options = ['naam', 'name'];
	for (var i = 0; i < options.length; ++i) {
		if (options[i] in props) {
			return props[options[i]];
		}
	}

	return null;
}

function showFeaturePopup(feature, evt) {
	$(popup.getElement()).render({
		'popover-title': featureLabel(feature),
		'feature-property-table':
			$.map(feature.getProperties(), function(v, k) {
				return { 'key': k, 'value': v };
			}).filter(function(pair) {
				return !/^(OBJECTID$|GLOBALID$|SHAPE$|SHAPE_)/.test(pair.key);
			})
	}).show();
	popup.setPosition(evt.coordinate);
}

function hideFeaturePopup() {
	$(popup.getElement()).hide();
}

$(popup.getElement()).find('.close').on('click', function(e) {
	e.preventDefault();
	hideFeaturePopup();
});

var featureSelectionMenu = new ol.Overlay({
	element: $('#feature-selection-menu').detach().get(0),
	positioning: 'center-left',
	stopEvent: true
});

map.addOverlay(featureSelectionMenu);

function showFeatureSelector(features, evt) {
	$(featureSelectionMenu.getElement())
		.empty()
		.append(
			$.map(features, function(feature) {
				return $('<li>').append($('<a>').attr('href', '#').data('feature', feature).text(featureLabel(feature) || '[Geen label]'));
			}))
		.show();
	featureSelectionMenu.setPosition(evt.coordinate);
}

function hideFeatureSelector() {
	$(featureSelectionMenu.getElement()).hide();
}

// Hide the featureSelectionMenu when we click outside it
$(document.body).on('mousedown', function(e) {
	if (!$.contains(featureSelectionMenu.getElement(), e.target)) {
		hideFeatureSelector();
	}
});

var hoverStyle = new ol.style.Style({
	stroke: new ol.style.Stroke({
		color: 'red',
		width: 2
	}),
	fill: new ol.style.Fill({
		color: [0, 0, 255, 0.6]
	})
});

// When we hover over a menu item in the feature selector, highlight that feature!
$('#feature-selection-menu')
	.on('mouseover', 'a', function(e) {
		var feature = $(this).data('feature');
		feature.setStyle(hoverStyle);
	})
	.on('mouseout', 'a', function(e) {
		var feature = $(this).data('feature');
		feature.setStyle(null);
	})
	.on('click', 'a', function(e) {
		e.preventDefault();
		var feature = $(this).data('feature');
		hideFeatureSelector();
		showFeaturePopup(feature, {coordinate: featureSelectionMenu.getPosition()});
	});



map.on('click', function(evt) {
	// If we click inside the feature popup, don't do anything special with the map.
	// if ($(popup.getElement()).atPoint({x: evt.originalEvent.pageX, y: evt.originalEvent.pageY}).size() > 0)
	// 	return;
	
	var features = [];

	map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
		features.push(feature);
	});

	if (features.length === 1)
		showFeaturePopup(features[0], evt);
	else if (features.length > 1) {
		hideFeaturePopup();
		showFeatureSelector(features, evt);
	}
});
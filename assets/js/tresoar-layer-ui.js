jQuery(function($) {
	var pos = null;
	var width = 0;

	function setLayerPanelWidth(width) {
		width = Math.max(Math.min(width, 500), 100);
		$('#layers').width(width)
		$('#map').css('left', width);
		map.updateSize();
		localStorage['layerPanelWidth'] = width;
	}

	$('#layers .resize-handle').on('mousedown', function(e) {
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

	if ('layerPanelWidth' in localStorage) {
		setLayerPanelWidth(localStorage['layerPanelWidth']);
	}
});
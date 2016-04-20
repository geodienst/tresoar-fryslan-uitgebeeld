if (!Array.prototype.find) {
	Array.prototype.find = function(filter) {
		for (var i = 0; i < this.length; ++i) {
			if (filter(this[i])) {
				return this[i];
			}
		}
		return undefined;
	};
}

// Helper for jQuery.ajax and co. to easily use proxy server to go around CSRP
jQuery.ajaxPrefilter(function(options) {
	if (options.crossdomain) {
		options.url = 'proxy.php?url=' + encodeURIComponent(options.url);
		//options.url = 'http://mirror.ikhoefgeen.nl/tresoar-proxy.php?url=' + encodeURIComponent(options.url);
		options.crossdomain = false;
	}
});

jQuery.fn.atPoint = function(point) {
	return $(this).filter(function() {
		var offset = $(this).offset(),
			width = $(this).width(),
			height = $(this).height();

		return offset.top <= point.y && offset.top + height >= point.y
			&& offset.left <= point.x && offset.left + width >= point.x;
	});
};

Array.prototype.toHTMLTable = function() {
	var $table = $('<table>'),
		$tbody = $('<tbody>').appendTo($table);

	this.forEach(function(pair) {
		var $tr = $('<tr>').appendTo($tbody);
		$('<th>').text(pair.key).appendTo($tr);
		if (pair.value instanceof jQuery) {
			$('<td>').append(pair.value).appendTo($tr);
		} else {
			$('<td>').text(pair.value).appendTo($tr);
		}
	});

	return $table;
}
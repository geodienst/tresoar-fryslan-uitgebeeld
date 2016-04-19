<?php

header('Access-Control-Allow-Origin: ' . $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['HTTP_HOST']);
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Max-Age: 1728000');

$allowed = [
	'{^http://geoportaal\.fryslan\.nl/arcgis/services/ProvinciaalGeoRegister/PGR_features/GeoDataServer/WFSServer.+?}'
];

function is_whitelisted($url, $whitelist) {
	foreach ($whitelist as $pattern)
		if (preg_match($pattern, $url))
			return true;
	return false;
}

if (!isset($_GET['url'])) {
	header('HTTP/1.0 400 Bad Request');
	die('url parameter missing');
}

$url = $_GET['url'];
unset($_GET['url']);

$url = $url . (strpos($url, '?') === false ? '?' : '&') . http_build_query($_GET);

if (!is_whitelisted($url, $allowed)) {
	header('HTTP/1.0 403 Forbidden');
	die('The requested URL is not whitelisted in the proxy script');
}

if (!($fh = @fopen($url, 'rb'))) {
	header('HTTP/1.0 500 Internal Server Error');
	$error = error_get_last();
	die($error['message']);
}

fpassthru($fh);
fclose($fh);

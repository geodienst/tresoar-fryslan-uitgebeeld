<?php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Max-Age: 1728000');

if (!isset($_GET['url']))
	die('url parameter missing');

$url = $_GET['url'];
unset($_GET['url']);

$url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($_GET);

$cache_file = '/tmp/tresoarproxy/' . sha1($url);

$nocache = true;

if (!file_exists($cache_file) || $nocache) {
	if (!$nocache) 
		if (!is_dir(dirname($cache_file)))
			mkdir(dirname($cache_file));

	$response = file_get_contents($url);
	if (!$nocache) file_put_contents($cache_file, $response);
	echo $response;
} else {
	$fh = fopen($cache_file, 'rb');
	fpassthru($fh);
}

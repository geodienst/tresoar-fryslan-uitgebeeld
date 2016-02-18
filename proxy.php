<?php

if (!isset($_GET['url']))
	die('url parameter missing');

if (!is_dir('/tmp/tresoarproxy'))
	mkdir('/tmp/tresoarproxy');

$url = $_GET['url'];
unset($_GET['url']);

$url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($_GET);

$tmp_file = '/tmp/tresoarproxy/' . sha1($url);

if (file_exists($tmp_file))
	echo file_get_contents($tmp_file);
else {
	$response = file_get_contents($url);
	file_put_contents($tmp_file, $response);
	echo $response;
}

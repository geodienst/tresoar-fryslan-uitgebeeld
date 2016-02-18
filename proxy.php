<?php

if (!isset($_GET['url']))
	die('url parameter missing');

$url = $_GET['url'];
unset($_GET['url']);

$url .= (strpos($url, '?') === false ? '?' : '&') . http_build_query($_GET);

$fh = fopen($url, 'rb');
fpassthru($fh);
<?php

// error_reporting(E_ALL);
// ini_set('display_errors', 1); 

// $tempDir = __DIR__ . DIRECTORY_SEPARATOR . 'temp';
// if (!file_exists($tempDir)) {
// 	mkdir($tempDir);
// }
// echo "HI";
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {	
		header("HTTP/1.1 204 No Content");
}
// echo "BOO";

$json = file_get_contents('php://input');
$obj = json_decode($json);
$file = $obj->tmp;

// echo "\n\n file: ".$file;
$ok = 1;
//we need to check the $file being OK
if($file && strpos($file, '..') == false && strpos($file, 'temp/') !== false && substr($file, 0, 4) == "temp") {
    //we check that the user isn't trying to access another directory
    //and that the file passed on to us contains the temp/
    unlink($file);
} else {
    $ok = 2;
}


echo json_encode([
    'success' => ($ok == 1) ? true : false,
    'files' => $file
]);
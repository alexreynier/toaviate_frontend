<?php

// error_reporting(E_ALL);
// ini_set('display_errors', 1); 

$tempDir = __DIR__ . DIRECTORY_SEPARATOR . 'temp';
if (!file_exists($tempDir)) {
	mkdir($tempDir);
}
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
	$chunkDir = $tempDir . DIRECTORY_SEPARATOR . $_GET['flowIdentifier'];
	$chunkFile = $chunkDir.'/chunk.part'.$_GET['flowChunkNumber'];
	if (file_exists($chunkFile)) {
		header("HTTP/1.0 200 Ok");
	} else {
		header("HTTP/1.1 204 No Content");
	}
}

//check the content that has been provided matches the right type of images

date_default_timezone_set('UTC');
$date = new DateTime();

function generateRandomString($length = 5) {
    $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    $charactersLength = strlen($characters);
    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, $charactersLength - 1)];
    }
    return $randomString;
}

$path_parts =  pathinfo($_FILES["file"]["name"]);
// echo $path_parts['extension'];
$imageFileType = strtolower(pathinfo($_FILES["file"]["name"],PATHINFO_EXTENSION));
$target_dir = "temp/";
$target_file = $target_dir . basename($date->getTimestamp() . generateRandomString(23) );
$uploadOk = 1;

// Check if image file is a actual image or fake image
// echo "TYPE: ".$imageFileType;

$check = filesize($_FILES["file"]["tmp_name"]);
if($check !== false) {
    // echo "File is an image - " . $check["mime"] . ".";
    $uploadOk = 1;
} else {
    // echo "File is not an image.";
    $uploadOk = 0;
}
// Check if file already exists
if (file_exists($target_file)) {
    //re-generate the name:

     // echo "Sorry, file already exists.";
    
    $uploadOk = 0;
}
// Check file size
if ($_FILES["file"]["size"] > 500000000) {
     // echo "Sorry, your file is too large.";
    $uploadOk = 0;
}
// Allow certain file formats
if($imageFileType == "jpg" || $imageFileType == "png" || $imageFileType == "jpeg" || $imageFileType == "gif" || $imageFileType == "JPG" ) {
    //echo "Sorry, only JPG, JPEG, PNG & GIF files are allowed.";
    //time to convert the image if it isn't right...
    //if($imageFileType !== "jpg"){
        
        //let's convert them all to JPG files
        $exploded = explode('.',$target_file);
        $ext = $exploded[count($exploded) - 1]; 
        $outputImage = $exploded[0].".jpg";

        if (preg_match('/jpg|jpeg/i',$ext))
            $imageTmp=imagecreatefromjpeg($target_file);
        else if (preg_match('/png/i',$ext))
            $imageTmp=imagecreatefrompng($target_file);
        else if (preg_match('/gif/i',$ext))
            $imageTmp=imagecreatefromgif($target_file);
        else if (preg_match('/bmp/i',$ext))
            $imageTmp=imagecreatefrombmp($target_file);
        
        // quality is a value from 0 (worst) to 100 (best)
        imagejpeg($imageTmp, $outputImage, 100);
        imagedestroy($imageTmp);

        //and update the targetFile link
        $target_file = $outputImage;

    //}

    $uploadOk = 1;
} elseif($imageFileType == "pdf" || $imageFileType == "PDF" || $imageFileType == "doc" || $imageFileType == "docx" || $imageFileType == "xls" || $imageFileType == "xlsx" || $imageFileType == "zip"  || $imageFileType == "avi" || $imageFileType == "mp4" || $imageFileType == "ppt" || $imageFileType == "pptx" ) {

    $uploadOk = 1;


} else {
    // echo "FILE TYPE";
    $uploadOk = 0;
}
// Check if $uploadOk is set to 0 by an error
if ($uploadOk == 0) {
    // echo "Sorry, your file was not uploaded.";
    // if everything is ok, try to upload file
} else {
    if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
        //echo "The file ". basename( $_FILES["file"]["name"]). " has been uploaded.";
        $_FILES["file"]["tmp_name"] = $target_file;
        $_POST["flowFilename"] = $target_file;
        $_POST["flowRelativePath"] = $target_file;
    } else {
        //echo "Sorry, there was an error uploading your file.";
    }
}




// Just imitate that the file was uploaded and stored.
//sleep(2);


echo json_encode([
    'success' => ($uploadOk == 1) ? true : false,
    'files' => $_FILES,
    'get' => $_GET,
    'post' => $_POST,
    //optional
    'flowTotalSize' => isset($_FILES['file']) ? $_FILES['file']['size'] : $_GET['flowTotalSize'],
    'flowIdentifier' => $target_file,
    'flowFilename' => $target_file,
    'flowRelativePath' => $target_file,
    'saved_url' => $target_file
]);
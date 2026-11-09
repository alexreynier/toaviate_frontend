<?php
/*
 * Social preview for shared flight replays: /f/{token} (be-alex-3e C30, mockups/my-account/flight-sharing-build.md §10).
 *
 * Link-preview crawlers (WhatsApp, iMessage, Slack…) don't run Angular, and .htaccess sends every other path to
 * index.html. A rule ahead of that catch-all sends /f/{token} here: this prints og: tags for a valid link into the app
 * shell (index.html) and serves it, so people get the normal app (state `flight_share` reads the same token).
 * A link the API refuses prints no tags. No track drawing is made on the server (ruled out as too heavy).
 *
 * The API host: env TOAVIATE_API_BASE (Apache SetEnv) if set, else chosen from this site's host name.
 * The preview read sends ?preview=1 so the backend doesn't count it as an open.
 */

header('Referrer-Policy: strict-origin-when-cross-origin');   // the token is in the URL: send only the origin onwards
header('X-Robots-Tag: noindex');

$shell = @file_get_contents(__DIR__ . '/index.html');
if ($shell === false) {
    http_response_code(500);
    exit;
}

$token = isset($_GET['token']) ? preg_replace('/[^A-Za-z0-9_-]/', '', (string)$_GET['token']) : '';

function share_api_base($host)
{
    $env = getenv('TOAVIATE_API_BASE');
    if ($env) {
        return rtrim($env, '/');
    }
    $host = strtolower((string)$host);
    if (strpos($host, 'local') !== false) {
        return 'https://local-api.toaviate.com';
    }
    if (strpos($host, 'staging') !== false || strpos($host, 'v1.') === 0) {
        return 'https://v1.toaviate.com';
    }
    return 'https://api.toaviate.com';
}

function share_fetch($url)
{
    if (!function_exists('curl_init')) {
        return null;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 3,
        CURLOPT_HTTPHEADER => array('Accept: application/json', 'X-ToAviate-Preview: 1'),
    ));
    if (strpos($url, 'https://local-api.') === 0) {
        // the local dev API uses a self-signed certificate; real hosts keep full verification
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }
    $body = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !$body) {
        return null;
    }
    $data = json_decode($body, true);
    return is_array($data) ? $data : null;
}

function share_minutes($summary)
{
    foreach (array('airborne_minutes', 'duration_minutes', 'flight_minutes', 'minutes') as $k) {
        if (isset($summary[$k]) && is_numeric($summary[$k])) {
            return (int)round($summary[$k]);
        }
    }
    foreach (array('airborne_seconds', 'duration_seconds', 'seconds') as $k) {
        if (isset($summary[$k]) && is_numeric($summary[$k])) {
            return (int)round($summary[$k] / 60);
        }
    }
    return null;
}

function share_nm($summary)
{
    foreach (array('distance_nm', 'distance', 'nm') as $k) {
        if (isset($summary[$k]) && is_numeric($summary[$k])) {
            return (int)round($summary[$k]);
        }
    }
    return null;
}

function share_place($p)
{
    if (!is_array($p)) {
        return '';
    }
    $name = isset($p['name']) ? trim((string)$p['name']) : '';
    $code = isset($p['code']) ? trim((string)$p['code']) : '';
    return $name !== '' ? $name : $code;
}

$tags = '';
if ($token !== '') {
    $scheme = 'https://';
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    $api = share_api_base($host);
    $data = share_fetch($api . '/api/v1/flight_share/' . rawurlencode($token) . '?preview=1');
    if ($data && !empty($data['success']) && !empty($data['flight']) && is_array($data['flight'])) {
        $f = $data['flight'];
        $reg = isset($f['registration']) ? trim((string)$f['registration']) : '';
        $from = share_place(isset($f['from']) ? $f['from'] : null);
        $to = share_place(isset($f['to']) ? $f['to'] : null);
        if ($from !== '' && $to !== '' && $from !== $to) { $route = $from . ' to ' . $to; }
        elseif ($from !== '') { $route = 'Local flight at ' . $from; }
        else { $route = 'A flight'; }
        $title = ($reg !== '' ? $reg . ': ' : '') . $route;

        $bits = array();
        $summary = isset($data['summary']) && is_array($data['summary']) ? $data['summary'] : array();
        $mins = share_minutes($summary);
        $nm = share_nm($summary);
        if ($mins !== null) {
            $bits[] = $mins . ' minute' . ($mins === 1 ? '' : 's');
        }
        if ($nm !== null) {
            $bits[] = $nm . ' nm';
        }
        $desc = $bits ? implode(', ', $bits) . '.' : 'A flight replay on ToAviate.';
        if (!empty($data['shared_by'])) {
            $desc .= ' Shared by ' . trim((string)$data['shared_by']) . '.';
        }

        // the first photo when the link shows photos, else the fixed ToAviate card
        $image = $scheme . $host . '/images/main_logo.png';
        if (!empty($data['photos']) && is_array($data['photos']) && isset($data['photos'][0]['id'])) {
            $image = $api . '/api/v1/flight_share/' . rawurlencode($token) . '/photo/' . (int)$data['photos'][0]['id'] . '?size=full';
        }
        $url = $scheme . $host . '/f/' . $token;

        $e = function ($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); };
        $tags = "\n    <!-- shared flight preview (share.php) -->\n"
            . '    <meta property="og:type" content="website" />' . "\n"
            . '    <meta property="og:site_name" content="ToAviate" />' . "\n"
            . '    <meta property="og:title" content="' . $e($title) . '" />' . "\n"
            . '    <meta property="og:description" content="' . $e($desc) . '" />' . "\n"
            . '    <meta property="og:image" content="' . $e($image) . '" />' . "\n"
            . '    <meta property="og:url" content="' . $e($url) . '" />' . "\n"
            . '    <meta name="twitter:card" content="summary_large_image" />' . "\n";
    }
}

$tags .= '    <meta name="robots" content="noindex" />' . "\n"
    . '    <meta name="referrer" content="strict-origin-when-cross-origin" />' . "\n";

$pos = stripos($shell, '</head>');
echo $pos === false ? $shell : substr($shell, 0, $pos) . $tags . substr($shell, $pos);

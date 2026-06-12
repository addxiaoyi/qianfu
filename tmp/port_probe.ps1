$target = '103.236.92.10'
$ports = @(22,80,443,8888,7800,20,21,3000,3001,3012,8080,8001,2022,10022,8022)
foreach($p in $ports){
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.ReceiveTimeout = 2000
    $client.SendTimeout = 2000
    $client.Connect($target,$p)
    Write-Output ("{0}:open" -f $p)
  } catch {
    $msg = $_.Exception.InnerException.Message
    if(-not $msg){ $msg = $_.Exception.Message }
    Write-Output ("{0}:closed:{1}" -f $p,$msg)
  } finally {
    $client.Close()
  }
}

# Creates android/.ssl-truststore.jks when Norton (or similar) HTTPS scanning
# breaks Gradle dependency downloads (PKIX path building failed).
# Run from repo root: .\scripts\setup-android-ssl-truststore.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$androidDir = Join-Path $repoRoot 'android'
$truststore = Join-Path $androidDir '.ssl-truststore.jks'
$javaHome = $env:JAVA_HOME
if (-not $javaHome) {
  throw 'JAVA_HOME is not set. Install JDK 17+ and set JAVA_HOME.'
}
$keytool = Join-Path $javaHome 'bin\keytool.exe'
$cacerts = Join-Path $javaHome 'lib\security\cacerts'

Write-Host 'Fetching TLS chain from Maven Central...'
$tcp = New-Object System.Net.Sockets.TcpClient('repo.maven.apache.org', 443)
$ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, ({ $true }))
$ssl.AuthenticateAsClient('repo.maven.apache.org')
$remote = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $ssl.RemoteCertificate
$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
$chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
[void]$chain.Build($remote)
$root = $chain.ChainElements[$chain.ChainElements.Count - 1].Certificate
$tempCer = Join-Path $env:TEMP 'gradle-ssl-scan-root.cer'
Export-Certificate -Cert $root -FilePath $tempCer -Force | Out-Null
$ssl.Dispose()
$tcp.Dispose()

Write-Host "Root CA: $($root.Subject)"
Copy-Item $cacerts $truststore -Force
& $keytool -importcert -noprompt -alias ssl-scan-root -file $tempCer -keystore $truststore -storepass changeit
Remove-Item $tempCer -Force -ErrorAction SilentlyContinue
Write-Host "Truststore written to $truststore"
Write-Host 'Gradle is already configured in android/gradle.properties to use this file.'

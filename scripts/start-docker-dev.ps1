$ErrorActionPreference = "Stop"

$privateAddressPatterns = @(
    "^192\.168\.",
    "^10\.",
    "^172\.(1[6-9]|2[0-9]|3[0-1])\."
)

$ignoredInterfaces = @(
    "*Docker*",
    "*WSL*",
    "*vEthernet*",
    "*Virtual*",
    "*Loopback*",
    "*Bluetooth*"
)

function Test-PrivateAddress {
    param([string] $Address)

    foreach ($pattern in $privateAddressPatterns) {
        if ($Address -match $pattern) {
            return $true
        }
    }

    return $false
}

$candidateAddresses = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.PrefixOrigin -ne "WellKnown" -and
        $_.IPAddress -ne "127.0.0.1" -and
        (Test-PrivateAddress $_.IPAddress)
    } |
    Where-Object {
        $interfaceName = $_.InterfaceAlias
        -not ($ignoredInterfaces | Where-Object { $interfaceName -like $_ })
    } |
    Sort-Object InterfaceMetric, InterfaceAlias

$lanAddress = $candidateAddresses | Select-Object -First 1

Write-Host ""
Write-Host "Starting Tagged with Docker..."
docker compose up -d --build

Write-Host ""
Write-Host "Tagged is available at:"
Write-Host "  PC:     http://localhost:5173"

if ($lanAddress) {
    Write-Host "  Mobile: http://$($lanAddress.IPAddress):5173"
    Write-Host ""
    Write-Host "Detected LAN adapter: $($lanAddress.InterfaceAlias)"
} else {
    Write-Host "  Mobile: LAN IPv4 could not be detected automatically."
    Write-Host ""
    Write-Host "Check that Wi-Fi/Ethernet is connected and that the network is private."
}

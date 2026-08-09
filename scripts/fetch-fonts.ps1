[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ua   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
$root = 'C:\Users\hix18\Documents\Github\not-projesi'
$dir  = "$root\public\fonts"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

$fams = @(
  @{ slug = 'newsreader'; url = 'https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,300..700'; family = 'Newsreader' },
  @{ slug = 'plex-sans';  url = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400..600';        family = 'IBM Plex Sans' },
  @{ slug = 'plex-mono';  url = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400';             family = 'IBM Plex Mono' }
)

$css = New-Object System.Text.StringBuilder
[void]$css.AppendLine("/* Self-hosted, subset to latin + latin-ext.")
[void]$css.AppendLine("   latin alone drops Turkish g-breve, s-cedilla and dotted I, so latin-ext is required.")
[void]$css.AppendLine("   Regenerate with scripts/fetch-fonts.ps1 - do not hand-edit. */")
[void]$css.AppendLine()

foreach ($f in $fams) {
  # -ErrorAction Stop: a failed request must abort, not silently reuse the previous sheet
  $sheet = (Invoke-WebRequest -Uri $f.url -Headers @{ 'User-Agent' = $ua } -UseBasicParsing -TimeoutSec 40 -ErrorAction Stop).Content
  $seen = @{}
  foreach ($b in [regex]::Matches($sheet, '@font-face\s*\{[^}]*\}')) {
    $t  = $b.Value
    $ur = [regex]::Match($t, 'unicode-range:\s*([^;]+);').Groups[1].Value.Trim()
    $u  = [regex]::Match($t, 'url\((https://[^)]+\.woff2)\)').Groups[1].Value
    if (-not $u) { continue }
    $isLatin    = $ur -match 'U\+0000-00FF'
    $isLatinExt = $ur -match 'U\+0100-'
    if (-not ($isLatin -or $isLatinExt)) { continue }
    $subset = $(if ($isLatinExt) { 'latin-ext' } else { 'latin' })
    if ($seen.ContainsKey($subset)) { continue }
    $seen[$subset] = $true

    $wt   = [regex]::Match($t, 'font-weight:\s*([0-9 ]+);').Groups[1].Value.Trim()
    $name = "$($f.slug)-$subset.woff2"
    Invoke-WebRequest -Uri $u -OutFile "$dir\$name" -UseBasicParsing -TimeoutSec 40
    $kb = [math]::Round((Get-Item "$dir\$name").Length / 1KB, 1)

    [void]$css.AppendLine("@font-face {")
    [void]$css.AppendLine("  font-family: '$($f.family)';")
    [void]$css.AppendLine("  font-style: normal;")
    [void]$css.AppendLine("  font-weight: $wt;")
    [void]$css.AppendLine("  font-display: swap;")
    [void]$css.AppendLine("  src: url('/fonts/$name') format('woff2');")
    [void]$css.AppendLine("  unicode-range: $ur;")
    [void]$css.AppendLine("}")
    [void]$css.AppendLine()
    Write-Output ("{0,-28} weight {1,-9} {2} KB" -f $name, $wt, $kb)
  }
}

$css.ToString().TrimEnd() + "`n" | Out-File -FilePath "$root\src\styles\fonts.css" -Encoding utf8 -NoNewline
Write-Output ''
Write-Output "wrote src/styles/fonts.css"

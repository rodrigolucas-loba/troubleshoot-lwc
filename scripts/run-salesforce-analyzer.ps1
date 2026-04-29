param(
    [string]$Workspace = ".",
    [string[]]$Targets = @("force-app"),
    [string[]]$RuleSelectors = @("Recommended", "CustomPMD"),
    [string]$OutputCsv = "docs/code-analyzer-report.csv",
    [string]$OutputMd = "docs/code-analyzer-report.md",
    [switch]$StageArtifacts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-ParentDirectory {
    param([string]$Path)

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

function Get-SeveritySortValue {
    param([string]$Severity)

    $parsed = 0
    if ([int]::TryParse($Severity, [ref]$parsed)) {
        return $parsed
    }

    switch ($Severity.ToLowerInvariant()) {
        "high" { return 5 }
        "moderate" { return 4 }
        "medium" { return 4 }
        "low" { return 3 }
        default { return 0 }
    }
}

function ConvertTo-MarkdownTable {
    param(
        [string[]]$Headers,
        [object[]]$Rows
    )

    if ($Rows.Count -eq 0) {
        return @("_None_")
    }

    $lines = @()
    $lines += "| " + ($Headers -join " | ") + " |"
    $lines += "| " + (($Headers | ForEach-Object { "---" }) -join " | ") + " |"

    foreach ($row in $Rows) {
        $cells = foreach ($header in $Headers) {
            $value = $row.$header
            if ($null -eq $value) { "" } else { ($value.ToString() -replace "\|", "\|") }
        }
        $lines += "| " + ($cells -join " | ") + " |"
    }

    return $lines
}

$resolvedCsv = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputCsv))
$resolvedMd = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputMd))

New-ParentDirectory -Path $resolvedCsv
New-ParentDirectory -Path $resolvedMd

$analyzerArgs = @("code-analyzer", "run")
foreach ($selector in $RuleSelectors) {
    $analyzerArgs += @("--rule-selector", $selector)
}
foreach ($target in $Targets) {
    $analyzerArgs += @("--target", $target)
}
$analyzerArgs += @("--workspace", $Workspace, "--output-file", $resolvedCsv, "--view", "table")

Write-Host "Running Salesforce Code Analyzer..."
& sf @analyzerArgs
$analyzerExitCode = $LASTEXITCODE

if (-not (Test-Path -LiteralPath $resolvedCsv)) {
    throw "Salesforce Code Analyzer did not produce the CSV report: $resolvedCsv"
}

$rows = @(Import-Csv -LiteralPath $resolvedCsv)

$totalFindings = $rows.Count
$generatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss zzz")
$highestSeverity = if ($totalFindings -gt 0) {
    ($rows | Sort-Object @{ Expression = { Get-SeveritySortValue $_.severity } } -Descending | Select-Object -First 1).severity
} else {
    "none"
}

$severityRows = @(
    $rows |
        Group-Object severity |
        Sort-Object @{ Expression = { Get-SeveritySortValue $_.Name } } -Descending |
        ForEach-Object {
            [pscustomobject]@{
                Severity = $_.Name
                Findings = $_.Count
            }
        }
)

$engineRows = @(
    $rows |
        Group-Object engine |
        Sort-Object Count -Descending |
        ForEach-Object {
            [pscustomobject]@{
                Engine = $_.Name
                Findings = $_.Count
            }
        }
)

$fileRows = @(
    $rows |
        Group-Object file |
        Sort-Object -Property @{ Expression = { $_.Count }; Descending = $true }, @{ Expression = { $_.Name }; Descending = $false } |
        Select-Object -First 10 |
        ForEach-Object {
            [pscustomobject]@{
                File = $_.Name
                Findings = $_.Count
            }
        }
)

$ruleRows = @(
    $rows |
        Group-Object rule |
        Sort-Object -Property @{ Expression = { $_.Count }; Descending = $true }, @{ Expression = { $_.Name }; Descending = $false } |
        Select-Object -First 10 |
        ForEach-Object {
            [pscustomobject]@{
                Rule = $_.Name
                Findings = $_.Count
            }
        }
)

$markdown = @()
$markdown += "# Salesforce Code Analyzer Summary"
$markdown += ""
$markdown += "- Generated: $generatedAt"
$markdown += "- Workspace: $Workspace"
$markdown += "- Targets: " + ($Targets -join ", ")
$markdown += "- Rule selectors: " + ($RuleSelectors -join ", ")
$markdown += "- CSV report: " + (Resolve-Path -LiteralPath $resolvedCsv -Relative)
$markdown += "- Total findings: $totalFindings"
$markdown += "- Highest reported severity: $highestSeverity"
$markdown += ""
$markdown += "## Severity Breakdown"
$markdown += ""
$markdown += ConvertTo-MarkdownTable -Headers @("Severity", "Findings") -Rows $severityRows
$markdown += ""
$markdown += "## Findings by Engine"
$markdown += ""
$markdown += ConvertTo-MarkdownTable -Headers @("Engine", "Findings") -Rows $engineRows
$markdown += ""
$markdown += "## Top Files"
$markdown += ""
$markdown += ConvertTo-MarkdownTable -Headers @("File", "Findings") -Rows $fileRows
$markdown += ""
$markdown += "## Top Rules"
$markdown += ""
$markdown += ConvertTo-MarkdownTable -Headers @("Rule", "Findings") -Rows $ruleRows

Set-Content -LiteralPath $resolvedMd -Value $markdown -Encoding utf8

if ($StageArtifacts) {
    & git add -- $resolvedCsv $resolvedMd
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to stage analyzer artifacts."
    }
}

Write-Host "CSV report written to $resolvedCsv"
Write-Host "Markdown summary written to $resolvedMd"

exit $analyzerExitCode

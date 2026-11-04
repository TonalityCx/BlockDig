param([switch]$Release)
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$editor = 'E:\Cocos\Creator\3.8.8\CocosCreator.exe'
$debugValue = if ($Release) { 'false' } else { 'true' }
$arguments = @('--project', $projectRoot, '--build', "`"platform=web-mobile;debug=$debugValue;startScene=63899b9c-7fba-4e94-a80e-173774556d31`"")
$build = Start-Process -FilePath $editor -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if ($build.ExitCode -ne 36) { throw "Cocos build failed with exit code $($build.ExitCode)." }
& node (Join-Path $PSScriptRoot 'postbuild.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Post-build failed.' }

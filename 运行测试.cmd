@echo off
cd /d "%~dp0"
node tools\runtime.cjs test
if errorlevel 1 goto done
node tools\runtime.cjs typecheck
if errorlevel 1 goto done
node tools\runtime.cjs verify
:done
pause

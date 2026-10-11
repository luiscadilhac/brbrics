@echo off
title BrBRICS - Servidor
cd /d "%~dp0"
echo ========================================
echo  BrBRICS - Portal de Transparencia
echo ========================================
echo.
echo  Instalando dependencias...
call npm install --no-audit --no-fund
echo.
echo  Iniciando servidor em http://localhost:3000
echo  O navegador abre em ~10 segundos.
echo  Para parar, feche esta janela.
echo.
start /b powershell -WindowStyle Hidden -Command "Start-Sleep 10; Start-Process 'http://localhost:3000'"
call npm start
pause

